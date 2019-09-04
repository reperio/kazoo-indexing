import { config } from './config';
import { AppLogger } from './logger';
import { Cache } from './cache';
import { CrossbarService } from './crossbarService';
import { ElasticService } from './elasticService';
import * as amqp from 'amqplib';
import CDRPRocessor from './cdrProcessor';
import * as moment from 'moment';

const logger = AppLogger(config);
const cache = new Cache();

async function getAMQPConnection(): Promise<amqp.Connection> {
    return new Promise((resolve, reject) => {
        const tryConnect = () => {
            amqp.connect(config.amqp.connection)
                .then((connection: any) => {
                    connection.on('close', () => {
                        logger.error('connection closed');
                        process.nextTick(run);
                    });
                    resolve(connection);
                }, (e: any) => {
                    if (e.code === 'ECONNREFUSED') {
                        logger.error(`amqp connection refused, retrying in ${config.amqp.connectionRetryIntervalSeconds} seconds`);
                        setTimeout(tryConnect, config.amqp.connectionRetryIntervalSeconds * 1000);
                    } else {
                        reject(e);
                    }
                });
        };

        tryConnect();
    });
}

async function main() {
    let crossbarService: CrossbarService;
    if (config.useCrossbarAMQP) {
        logger.info('using crossbar');
        crossbarService = new CrossbarService(config.crossbarApi, logger);
        if (!crossbarService.accountId) {
            await crossbarService.authenticate();
        }
    } else {
        logger.info('not using crossbar');
    }

    logger.info(`Attempting to establish amqp connection`);
    const connection = await getAMQPConnection();

    const channel = await connection.createChannel();
    logger.info('Created channel');

    channel.prefetch(1);

    await channel.assertQueue(config.amqp.queueName, {});
    await channel.assertExchange(config.amqp.exchangeName, 'topic', {
        durable: false
    });

    logger.info(`Binding queue '${config.amqp.queueName}' to exchange '${config.amqp.exchangeName}' with routing key '${config.amqp.routingKey}'`);
    await channel.bindQueue(config.amqp.queueName, config.amqp.exchangeName, config.amqp.routingKey);

    channel.consume(config.amqp.queueName, async (message: any) => {
        try {
            logger.info('Received new message');
            const callDetails = JSON.parse(message.content.toString());

            // Key renaming function from https://stackoverflow.com/questions/12539574/whats-the-best-way-most-efficient-to-turn-all-the-keys-of-an-object-to-lower
            const objectKeysToLowerCase = (input: any): any => {
                if (typeof input !== 'object') {
                    return input;
                }
                if (Array.isArray(input)) {
                    return input.map(objectKeysToLowerCase);
                }
                return Object.keys(input).reduce((newObj: any, key: string) => {
                    const val = input[key];
                    const newVal = (typeof val === 'object') ? objectKeysToLowerCase(val) : val;
                    newObj[key.toLowerCase().split('-').join('_')] = newVal;
                    return newObj;
                }, {});
            };

            const callRecord = objectKeysToLowerCase(callDetails);
            const timestamp = moment.unix(callRecord.timestamp - 62167219200);
            const formattedCdrId = `${timestamp.format('YYYYMM')}-${callRecord.call_id}`;
            callRecord.call_id = formattedCdrId;

            const cdr = CDRPRocessor.processCDR(config.useCrossbarAMQP ? (await crossbarService.getCdrByAccountAndId(callRecord.custom_channel_vars.account_id, formattedCdrId)).data : callRecord, logger);

            logger.debug(cdr);

            const index = 'cdrs_' + moment.utc(cdr.datetime).format('YYYYMM');
            const header = {
                update: {
                    _index: index,
                    _type: '_doc',
                    _id: cdr.id
                }
            };

            const doc = {
                doc: cdr,
                doc_as_upsert: true
            };

            logger.info(`Indexing document into elasticsearch`);
            const elasticService = new ElasticService(config.elasticsearchApi, logger);
            await elasticService.bulkInsert([header, doc]);
            logger.info(`${cdr.id} indexed into elasticsearch`);

            cache.set(cdr.id, timestamp);
            logger.info('added cdr id to cache');
        } catch (e) {
            logger.error('Failed to process CDR');
            logger.error(e);
        }
    }, {noAck: true});
}

function run() {
    main().then(() => logger.info('Connection established; waiting for messages'));
}

run();
