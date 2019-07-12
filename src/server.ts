import { config } from './config';
import { Server } from 'hapi';
import { AppLogger } from './logger';
import { Cache } from './cache';
import { CrossbarService } from './crossbarService';
import { ElasticService } from './elasticService';
import * as moment from 'moment';

const run = async () => {
    const logger = AppLogger(config);

    const server = new Server(config.server);
    const cache = new Cache();

    server.route({
        path: '/api/calls',
        method: 'POST',
        handler: async (request, h) => {
            const crossbarService = new CrossbarService(config.crossbarApi, logger);
            const elasticService = new ElasticService(config.elasticsearchApi, logger);

            if (!crossbarService.accountId) {
                await crossbarService.authenticate();
            }
            
            const callRecord: any = request.payload;
            logger.debug('Received new call record');
            logger.debug(JSON.stringify(callRecord));
            
            try {
                const timestamp = moment.unix(callRecord.timestamp - 62167219200);
                const formattedCdrId = `${timestamp.format('YYYYMM')}-${callRecord.call_id}`;
                logger.debug(formattedCdrId);

                if (!cache.hasKey(formattedCdrId)) {
                    const cdr = (await crossbarService.getCdrByAccountAndId(callRecord.account_id, formattedCdrId)).data;
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

            return 'success';
        }
    });

    await server.start();
    logger.info(`Server started on http://${server.info.address}:${server.info.port}`);
};

run();
