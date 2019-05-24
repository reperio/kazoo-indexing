

const _ = require('lodash');
const moment = require('moment-timezone');
const config = require('./config.js');
const commander = require('commander');
const winston = require('winston');
require('winston-daily-rotate-file');

const ElasticService = require('./elasticService');
const CrossbarService = require('./crossbarService');

class KazooIndexer {
    constructor(logger) {
        this.logger = logger;
        this.elasticService = new ElasticService(config.elasticsearchApi, logger);
        this.crossbarService = new CrossbarService(config.crossbarApi, logger);
    }

    formatBulkCdrInsert(cdrs) {
        const formattedCdrs = [];

        cdrs.forEach((cdr) => {
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

            formattedCdrs.push(header);
            formattedCdrs.push(doc);
        });

        return formattedCdrs;
    }

    async execute() {
        try {
            this.logger.info('Starting');
            
            const cdrs = await this.crossbarService.getCdrs();
            const formattedCdrs = this.formatBulkCdrInsert(cdrs);
            await this.elasticService.bulkInsert(formattedCdrs);

            this.logger.info(`Finished`);
        } catch (err) {
            this.logger.error('An error occurred');
            this.logger.error(err);
        }
    };
};

async function start(logger) {
    try {
        const indexer = new KazooIndexer(logger);
        await indexer.execute();
    } catch (err) {
        logger.error(err);
    }
}

async function startLoop(logger) {
    let executing = false;

    logger.info(`Starting Loop with interval: ${config.loopInterval}`);

    setInterval(async function () {
        if (!executing) {
            executing = true;
            try {
                const indexer = new KazooIndexer(logger);
                await indexer.execute();
            } catch (err) {
                logger.error(err);
            }
            executing = false;
        }
    }, config.loopInterval);
}

const consoleErrorStackFormat = winston.format.printf(info => {
    const properties = Object.getOwnPropertyNames(info);
    const ignoredProperties = ['timestamp', 'level', 'message', '_object', 'annotate', 'reformat', 'data', 'isBoom', 'isServer', 'isJoi'];
    const objectProperties = ['details', 'output'];

    if (info.message instanceof Object) {
        return `${info.timestamp} ${info.level} ${JSON.stringify(info.message)} : ${info.stack || ''}`;
    } else {
        let output = `${info.timestamp} ${info.level} ${info.message}`;
        for (const prop of properties) {
            if (_.includes(ignoredProperties, prop)) {
                continue;
            }

            if (_.includes(objectProperties, prop)) {
                output += ` ${prop}: ${JSON.stringify(info[prop])}`;
            } else {
                output += ` ${prop}: ${info[prop]}`;
            }
        }
        return output;
    }
});

const parseErrorFormat = winston.format(info => {
    if (info instanceof Error) {
      return Object.assign({
        message: info.message,
        stack: info.stack
      }, info);
    }
  
    return info;
  });

const logger = winston.createLogger({
    level: 'info',
    transports: [
        new winston.transports.Console(
            {
                level: config.logLevel,
                format: winston.format.combine(
                    winston.format.colorize(),
                    consoleErrorStackFormat
                )
            }
        ),
        new winston.transports.DailyRotateFile(
            {
                name: 'app-json-transport',
                filename: `${config.logDirectory}/app-%DATE%.log`,
                datePattern: 'YYYY-MM-DD'
            }
        )
    ],
    format: winston.format.combine(
        winston.format.timestamp(),
        parseErrorFormat(),
        winston.format.json(),
    )
});

commander
    .option('-l, --loop', 'Loop')
    .parse(process.argv);

if (commander.loop) {
    startLoop(logger);
} else {
    start(logger);
}


