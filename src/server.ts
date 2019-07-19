import { config } from './config';
import { Server } from 'hapi';
import { AppLogger } from './logger';
import { Cache } from './cache';
import { CrossbarService } from './crossbarService';
import { ElasticService } from './elasticService';
import * as moment from 'moment-timezone';

const run = async () => {
    const logger = AppLogger(config);

    const server = new Server(config.server);
    const cache = new Cache();

    const crossbarService = new CrossbarService(config.crossbarApi, logger);
    if (!crossbarService.accountId) {
        await crossbarService.authenticate();
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
                    logger.debug(formattedCdrId);

                    if (!cache.hasKey(formattedCdrId)) {
                        const cdr = (await crossbarService.getCdrByAccountAndId(callRecord.account_id, formattedCdrId)).data;

                        const cdrDate = moment.unix(cdr.timestamp - 62167219200);
                        cdr.datetime = cdrDate.format('YYYY-MM-DD HH:mm:ss');
                        cdr.unix_timestamp = cdrDate.unix();
                        cdr.rfc_1036 = cdrDate.format('ddd, D MMM YYYY HH:mm:ss zz');
                        cdr.iso_8601 = cdrDate.format('YYYY-MM-DD');
                        cdr.iso_8601_combined = cdrDate.format('YYYY-MM-DDTHH:mm:ss') + 'Z';

                        try {
                            cdr.dialed_number = cdr.call_direction === 'inbound' ? cdr.request.split('@')[0] : cdr.to.split('@')[0];
                        } catch (err) {
                            logger.error('Failed to determine dialed_number');
                            logger.error(err);
                        }
                        
                        try {
                            cdr.calling_from = cdr.call_direction === 'inbound' ? cdr.caller_id_number : cdr.from_uri.split('@')[0];
                        } catch (err) {
                            logger.error('Failed to determine calling_from');
                            logger.error(err);
                        }
                        
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
