import {config} from './config';
import {Server} from 'hapi';
import {AppLogger} from './logger';
import { CrossbarService } from './crossbarService';
import * as moment from 'moment';

const run = async () => {
    const logger = AppLogger(config);

    const server = new Server(config.server);

    server.route({
        path: '/api/calls',
        method: 'POST',
        handler: async (request, h) => {
            const crossbarService = new CrossbarService(config.crossbarApi, logger);

            if (!crossbarService.accountId) {
                await crossbarService.authenticate();
            }
            
            const callRecord: any = request.payload;
            logger.debug('Received new call record');
            logger.debug(JSON.stringify(callRecord));
            
            const timestamp = moment.unix(callRecord.timestamp - 62167219200);
            const formattedCdrId = `${timestamp.format('YYYYMM')}-${callRecord.call_id}`;
            logger.debug(formattedCdrId);

            const cdr = await crossbarService.getCdrByAccountAndId(callRecord.account_id, formattedCdrId);
            logger.debug(JSON.stringify(cdr));

            return 'success';
        }
    });

    await server.start();
    logger.info(`Server started on http://${server.info.address}:${server.info.port}`);
};

run();
