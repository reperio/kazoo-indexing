import {config} from './config';
import {Server} from 'hapi';
import {AppLogger} from './logger';

const run = async () => {
    const logger = AppLogger(config);

    const server = new Server(config.server);

    server.route({
        path: '/api/calls',
        method: 'POST',
        handler: async (request, h) => {
            const callRecord = request.payload;
            logger.debug('Received new call record');
            logger.debug(JSON.stringify(callRecord));

            return 'success';
        }
    });

    await server.start();
    logger.info(`Server started on http://${server.info.address}:${server.info.port}`);
};

run();
