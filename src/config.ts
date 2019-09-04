export const config = {
    loopInterval: process.env.LOOP_INTERVAL || 6000,
    loopWindow: process.env.LOOP_WINDOW || 5, // minutes
    includeParent: process.env.INCLUDE_PARENT || true,

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
        apiUrl: process.env.API_URL || 'http://localhost:8000/v2',
        account: process.env.ACCOUNT || 'company',
        credentials: process.env.CREDENTIALS || "echo 'user:pass' | md5sum"
    },
    logger: {
        directory: process.env.LOG_DIRECTORY || process.cwd() + '/logs',
        level: process.env.LOG_LEVEL || 'debug'
    },
    ESIndexes: {
        cdrs: process.env.INDEX_CDR || 'cdrs',
        recordings: process.env.INDEX_RECORDING || 'recordings'
    },
    server: {
        host: process.env.SERVER_HOST || '0.0.0.0',
        get port(): number {
            return parseInt(process.env.SERVER_PORT || '3000');
        }
    },
    cache: {
        get cleanInterval(): number {
            return parseInt(process.env.DICT_CLEAN_INTERVAL || `${1000 * 60 * 15}`);
        }
    },
    amqp: {
        connection: process.env.AMQP_CONNECTION_JSON != null ? JSON.parse(process.env.AMQP_CONNECTION_JSON) : (process.env.AMQP_CONNECTION_STRING || {hostname: 'localhost', username: 'guest', password: 'guest'}),
        queueName: process.env.AMQP_QUEUE_NAME || 'cdr_processor',
        exchangeName: process.env.AMQP_EXCHANGE_NAME || 'callevt',
        routingKey: process.env.AMQP_ROUTING_KEY || 'call.CHANNEL_DESTROY.*',
        connectionRetryIntervalSeconds: 10
    },
    webhookTimeout: process.env.WEBHOOK_TIMEOUT || '2000',
    useCrossbarWebhook: process.env.WEBHOOK_USE_CROSSBAR != null ? process.env.WEBHOOK_USE_CROSSBAR.toLowerCase() === 'true' : true
};

export type Config = typeof config;
export type CrossbarConfig = typeof config.crossbarApi;
export type ServerConfig = typeof config.server;
