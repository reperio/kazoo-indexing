export const config = {
    loopInterval: process.env.LOOP_INTERVAL || 60000,
    loopWindow: process.env.LOOP_WINDOW || 5, // minutes

    elasticsearchApi: {
        host: [
            {
                host: process.env.ELASTIC_HOST || 'localhost',
                auth: process.env.ELASTIC_AUTHENTICATION || '',
                protocol: process.env.ELASTIC_PROTOCOL || 'http',
                port: process.env.ELASTIC_PORT || 9200
            }
        ],
        log: 'error',
        requestTimeout: 60000
    },
    crossbarApi: {
        apiUrl: 'http://localhost:8000/v2',
        account: 'company',
        accountId: '',
        credentials: ''
    },
    logger: {
        directory: process.env.LOG_DIRECTORY || process.cwd() + '/logs',
        level: process.env.LOG_LEVEL || 'debug'
    },
    ESIndexes: {
        cdrs: process.env.INDEX_CDR || 'cdrs',
        recordings: process.env.INDEX_RECORDING || 'recordings'
    }
};

export type Config = typeof config;
export type CrossbarConfig = typeof config.crossbarApi;
