import { config } from './config';
import { Server } from 'hapi';
import { AppLogger } from './logger';
import { Cache } from './cache';
import { CrossbarService } from './crossbarService';
import { ElasticService } from './elasticService';
import * as moment from 'moment-timezone';
import { configure } from 'winston';
import CDRPRocessor from './cdrProcessor';

const run = async () => {
    const logger = AppLogger(config);

    const server = new Server(config.server);
    const cache = new Cache();
    let crossbarService: CrossbarService;

    if (config.useCrossbarWebhook) {
        logger.info('using crossbar');
        crossbarService = new CrossbarService(config.crossbarApi, logger);
        if (!crossbarService.accountId) {
            await crossbarService.authenticate();
        }
    } else {
        logger.info('not using crossbar');
    }

    server.route({
        path: '/api/calls',
        method: 'POST',
        handler: async (request, h) => {

            const elasticService = new ElasticService(config.elasticsearchApi, logger);
            const callRecord: any = request.payload;
            logger.debug('Received new call record');
            logger.debug(JSON.stringify(callRecord));

            setTimeout(async () => {
                try {
                    const timestamp = moment.unix(callRecord.timestamp - 62167219200);
                    const formattedCdrId = `${timestamp.format('YYYYMM')}-${callRecord.call_id}`;
                    callRecord.call_id = formattedCdrId;
                    logger.debug(formattedCdrId);

                    if (!cache.hasKey(formattedCdrId)) {
                        let cdr = config.useCrossbarWebhook ? (await crossbarService.getCdrByAccountAndId(callRecord.account_id, formattedCdrId)).data : callRecord;

                        cdr = CDRPRocessor.processCDR(cdr, logger);
                        
                        logger.debug(JSON.stringify(cdr));

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

                        await elasticService.bulkInsert([header, doc]);
                        logger.info(`${formattedCdrId} indexed into elasticsearch`);

                        const cdrDate = moment.unix(cdr.timestamp - 62167219200);
                        cache.set(formattedCdrId, timestamp);
                        logger.info('added formatted cdr id to cache');
                    } else {
                        logger.info(`CDR: ${formattedCdrId} has already been processed`);
                    }
                } catch (err) {
                    logger.error(err);
                }
            }, parseInt(config.webhookTimeout));
            return 'success';
        }
    });

    await server.start();
    logger.info(`Server started on http://${server.info.address}:${server.info.port}`);
};

run();
