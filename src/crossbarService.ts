import request from 'request-promise-native';
import moment from 'moment';
import _ from 'lodash';
import { CrossbarConfig } from './config';

export class CrossbarService {
    private apiUrl: string;
    private account: string;
    private accountId: string;
    private credentials: any;
    private logger: any;
    private authToken: string | null;

    constructor(config: CrossbarConfig, logger: any) {
        this.apiUrl = config.apiUrl;
        this.account = config.account;
        this.accountId = config.accountId;
        this.credentials = config.credentials;
        this.logger = logger;
        this.authToken = null;
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

        const url = `${this.apiUrl}/accounts/${this.accountId}/children`;

        const result = await this.sendCrossbarGetRequest(url);

        return result.data;
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
        if (!this.authToken) {
            await this.authenticate();
        }

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

        return request(httpOptions);
    }

    private async authenticate() {
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

        return result;
    }
}
