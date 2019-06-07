import _ from 'lodash';
import moment from 'moment-timezone';
import {config} from './config';
import commander from 'commander';
import winston, { Logger } from 'winston';
import WinstonDailyRotateFile from 'winston-daily-rotate-file';

import {ElasticService} from './elasticService';
import {CrossbarService} from './crossbarService';
import {AppLogger} from './logger';

export class KazooIndexer {
    private logger: Logger;
    private elasticService: ElasticService;
    private crossbarService: CrossbarService;

    constructor(appLogger: Logger) {
        this.logger = appLogger;
        this.elasticService = new ElasticService(config.elasticsearchApi, appLogger);
        this.crossbarService = new CrossbarService(config.crossbarApi, appLogger);
    }

    public async execute() {
        try {
            this.logger.info('Starting');
            
            const accounts = await this.crossbarService.getAccountChildren(config.accountId);

            for (const account of accounts) {
                this.logger.info(`Processing - ${account.name}`);

                const cdrs = await this.crossbarService.getCdrs(account.id);
                if (!cdrs || cdrs.length === 0) {
                    this.logger.info('No CDRs to index');
                    continue;
                }
                const formattedCdrs = this.formatBulkCdrInsert(cdrs);
                await this.elasticService.bulkInsert(formattedCdrs);
            }

            this.logger.info(`Finished`);
        } catch (err) {
            this.logger.error('An error occurred');
            this.logger.error(err);
        }
    }

    private formatBulkCdrInsert(cdrs: any) {
        const formattedCdrs: any[] = [];

        cdrs.forEach((cdr: any) => {
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
}

async function start(appLogger: Logger) {
    try {
        const indexer = new KazooIndexer(appLogger);
        await indexer.execute();
    } catch (err) {
        appLogger.error(err);
    }
}

async function startLoop(appLogger: Logger) {
    let executing = false;

    appLogger.info(`Starting Loop with interval: ${config.loopInterval}`);

    setInterval(async () => {
        if (!executing) {
            executing = true;
            try {
                const indexer = new KazooIndexer(appLogger);
                await indexer.execute();
            } catch (err) {
                appLogger.error(err);
            }
            executing = false;
        }
    }, config.loopInterval as number);
}

const logger = AppLogger(config);

commander
    .option('-l, --loop', 'Loop')
    .parse(process.argv);

if (commander.loop) {
    startLoop(logger);
} else {
    start(logger);
}
