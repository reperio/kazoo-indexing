import _ from 'lodash';
import moment from 'moment-timezone';
import { config } from './config';
import commander from 'commander';
import { Logger } from 'winston';

import { ElasticService } from './elasticService';
import { CrossbarService } from './crossbarService';
import { AppLogger } from './logger';

export class KazooIndexer {
    private logger: Logger;
    private elasticService: ElasticService;
    private crossbarService: CrossbarService;

    constructor(appLogger: Logger) {
        this.logger = appLogger;
        this.elasticService = new ElasticService(config.elasticsearchApi, appLogger);
        this.crossbarService = new CrossbarService(config.crossbarApi, appLogger);
    }

    public async execute(startDate: string | null, endDate: string | null, days: number | null, accountId: string | null) {
        try {
            const {rangeStart, rangeEnd}  = this.getDateRange(startDate, endDate, days);

            this.logger.info('Starting');

            const currentDate = rangeStart.clone();

            while (currentDate.isSameOrBefore(rangeEnd, 'day')) {
                this.logger.info(`Getting Accounts`);
                const accounts = await this.crossbarService.getAccountChildren(config.crossbarApi.accountId);
                const currentEndDate = currentDate.clone().endOf('day');

                for (const account of accounts) {
                    this.logger.info(`Processing account ${account.id}`);
                    if (accountId && accountId !== account.id) {
                        this.logger.info(`Skipping ${account.name} - ${account.id}`);
                        continue;
                    }

                    this.logger.info('');
                    this.logger.info(`Processing - ${account.name} - ${account.id}`);

                    const cdrs = await this.crossbarService.getCdrsForDateRange(account.id, currentDate.toDate(), currentEndDate.toDate());
                    if (!cdrs || cdrs.length === 0) {
                        this.logger.info('No CDRs to index');
                        continue;
                    }
                    const formattedCdrs = this.formatBulkCdrInsert(cdrs, account);
                    await this.elasticService.bulkInsert(formattedCdrs);
                }

                currentDate.add(1, 'day');
            }

            this.logger.info(`Finished`);
        } catch (err) {
            this.logger.error('An error occurred');
            this.logger.error(err);
        }
    }

    private formatBulkCdrInsert(cdrs: any, account: any) {
        const formattedCdrs: any[] = [];

        cdrs.forEach((cdr: any) => {
            cdr.account_id = account.id;
            cdr.account_name = account.name;
            cdr.account_realmn = account.realm;

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

    private getDateRange(startDate: string | null, endDate: string | null, days: number | null): {rangeStart: moment.Moment, rangeEnd: moment.Moment; } {
        if (startDate && endDate) {
            this.logger.info(`Starting with CLI provided start date: ${startDate} and end date: ${endDate}`);
            const rangeStart = moment(startDate + ' 000000', 'YYYYMMDD HHmmss');
            const rangeEnd = moment(endDate + ' 235959', 'YYYYMMDD HHmmss');

            return { rangeStart, rangeEnd };
        } else if (days) {
            this.logger.info(`Starting with CLI provided days: ${days}`);
            const rangeStart = moment().subtract(days, 'days');
            const rangeEnd = moment();

            return { rangeStart, rangeEnd };
        } else {
            const rangeStart = moment().subtract(config.loopWindow, 'minutes');
            const rangeEnd = moment();

            return { rangeStart, rangeEnd };
        }
    }
}

async function start(appLogger: Logger) {
    try {
        const indexer = new KazooIndexer(appLogger);
        await indexer.execute(commander.start_date, commander.end_date, commander.days, commander.account_id);
    } catch (err) {
        appLogger.error(err);
    }
}

async function startLoop(appLogger: Logger) {
    let executing = false;

    appLogger.info(`Starting Loop with interval: ${config.loopInterval} and window ${config.loopWindow}`);

    setInterval(async () => {
        if (!executing) {
            executing = true;
            try {
                const indexer = new KazooIndexer(appLogger);
                await indexer.execute(null, null, null, null);
            } catch (err) {
                appLogger.error(err);
            }
            executing = false;
        }
    }, config.loopInterval as number);
}

const logger = AppLogger(config);

commander
    .option('-h, --helpText', 'Print help text')
    .option('-l, --loop', 'Loop, ignores all other command args')
    .option('-s, --start_date [value]', 'Start Date in yyyymmdd, required if end_date is specified')
    .option('-e, --end_date [value]', 'End Date in yyyymmdd')
    .option('-a, --account_id [value]', 'Account Id if you only want to index a single account')
    .option('-d, --days [value]', 'Days to go back from now, will take precedence over start and end date arguments', parseInt)
    .parse(process.argv);

if (commander.helpText) {
    commander.help();
}

if (commander.end_date && !commander.start_date) {
    logger.info('Start date is required if end date is specified.');
    commander.help();
}

if (commander.loop) {
    startLoop(logger);
} else {
    start(logger);
}
