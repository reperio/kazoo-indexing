import request from 'request-promise-native';
import moment from 'moment';
import _ from 'lodash';
import { CrossbarConfig } from './config';

export class CrossbarService {
    public accountId: string | null;
    public accountName: string | null;
    private apiUrl: string;
    private account: string;
    private credentials: any;
    private authToken: string | null;
    private logger: any;

    constructor(config: CrossbarConfig, logger: any) {
        this.apiUrl = config.apiUrl;
        this.account = config.account;
        this.credentials = config.credentials;
        this.logger = logger;
        this.authToken = null;
        this.accountId = null;
        this.accountName = null;
    }

    public async getCdrByAccountAndId(accountId: string, cdrId: string) {
        const url = `${this.apiUrl}/accounts/${accountId}/cdrs/${cdrId}`;

        return await this.sendCrossbarGetRequest(url);
    }

    public async getCdrsForDateRange(accountId: string, startDate: Date, endDate: Date) {
        this.logger.info(`Getting cdrs for range ${startDate} - ${endDate}`);

        // seconds from year 0 - 1970 = 62167219200
        const startTime = moment(startDate).unix() + 62167219200;
        const endTime = moment(endDate).unix() + 62167219200;

        return await this.getCdrs(accountId, startTime, endTime);
    }

    public async getRecordings() {
        this.logger.info(`Getting recordings from Crossbar`);

        const url = `${this.apiUrl}/accounts/${this.accountId}/recordings`;

        const result = await this.sendCrossbarGetRequest(url);

        return result;
    }

    public async getRecording(recordingId: string) {
        this.logger.info(`Getting recordings from Crossbar`);

        const url = `${this.apiUrl}/accounts/${this.accountId}/recordings/${recordingId}`;

        const result = await this.sendCrossbarGetRequest(url);

        return result;
    }

    public async getAccountChildren(accountId: string) {
        this.logger.info(`Getting account children from Crossbar for account ${accountId}`);

        const url = `${this.apiUrl}/accounts/${this.accountId}/children?paginate=false`;

        const result = await this.sendCrossbarGetRequest(url);

        return result.data;
    }

    public async getAccountDescendants(accountId: string | null) {
        this.logger.info(`Getting account descendants from Crossbar for account ${accountId}`);

        const url = `${this.apiUrl}/accounts/${this.accountId}/descendants?paginate=false`;

        const result = await this.sendCrossbarGetRequest(url);

        return result.data;
    }

    public async authenticate() {
        this.logger.info(`Authenticating to Crossbar`);

        const url = `${this.apiUrl}/user_auth`;

        const httpOptions = {
            uri: url,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            json: {
                data: {
                  credentials: this.credentials,
                  account_name: this.account
                }
              }
        };

        this.logger.info(`Sending Auth request to Crossbar`);

        const result = await request(httpOptions);

        this.logger.info('Authentication Complete');

        this.authToken = result.auth_token;
        this.accountId = result.data.account_id;
        this.accountName = result.data.account_name;

        return result;
    }

    private async getCdrs(accountId: string, startTime: number, endTime: number) {
        let cdrs: any = [];
        this.logger.info(`Getting cdrs from Crossbar`);

        this.logger.info(`Using start time: ${startTime}`);
        
        const url = `${this.apiUrl}/accounts/${accountId}/cdrs?page_size=100&created_from=${startTime}&created_to=${endTime}`;

        let result = await this.sendCrossbarGetRequest(url);

        this.logger.info(`Crossbar request complete, found ${JSON.stringify(result.data.length)} cdrs`);
        cdrs = cdrs.concat(result.data);

        while (result.next_start_key) {
            this.logger.info('Getting next page of CDR results');
            const nextPageUrl = `${this.apiUrl}/accounts/${accountId}/cdrs?page_size=100&created_from=${startTime}&created_to=${endTime}&start_key=${result.next_start_key}`;

            result = await this.sendCrossbarGetRequest(nextPageUrl);
            this.logger.info(`Crossbar request complete, found ${JSON.stringify(result.data.length)} cdrs`);
            cdrs = cdrs.concat(result.data);
        }

        return cdrs;
    }

    private async sendCrossbarGetRequest(url: string) {

        const httpOptions = {
            uri: url,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': this.authToken
            },
            json: true
        };

        const safeOptions = _.cloneDeep(httpOptions);
        safeOptions.headers['X-Auth-Token'] = 'HIDDEN';
        this.logger.info(`Sending request to Crossbar: ${JSON.stringify(safeOptions)}`);

        try {
            return await request(httpOptions);
        } catch (err) {
            this.logger.error(err);
            this.logger.info('Attempting reauthentication...');
            await this.authenticate();
            this.logger.info('Resending request...');

            try {
                return await request(httpOptions);
            } catch (err) {
                this.logger.error('Reauthentication did not work');
                this.logger.error(err);
            }
        }
    }
}
