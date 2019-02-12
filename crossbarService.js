const request = require('request-promise-native');
const moment = require('moment');

class CrossbarService {
    constructor(config, logger) {
        this.apiUrl = config.apiUrl;
        this.account = config.account;
        this.accountId = config.accountId;
        this.credentials = config.credentials;
        this.logger = logger;
        this.authToken = null;
    }

    async authenticate() {
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

        //his.logger.info(`Sending request to Crossbar: ${JSON.stringify(httpOptions)}`);
        this.logger.info(`Sending Auth request to Crossbar`);

        const result = await request(httpOptions);

        this.logger.info('Authentication Complete');
        //this.logger.info(result.auth_token);

        this.authToken = result.auth_token;

        return result;
    }

    async getCdrs() {
        this.logger.info(`Getting cdrs from Crossbar`);
        if (!this.authToken) {
            await this.authenticate();
        }

        //seconds from year 0 - 1970 = 62167219200
        const startTime = moment().subtract(1, 'day').unix() + 62167219200;

        this.logger.info(`Using start time: ${startTime}`)
        
        const url = `${this.apiUrl}/accounts/${this.accountId}/cdrs?page_size=100&created_from=${startTime}`;

        const httpOptions = {
            uri: url,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': this.authToken
            },
            json: true
        };

        this.logger.info(`Sending request to Crossbar: ${JSON.stringify(httpOptions)}`);

        const result = await request(httpOptions);

        this.logger.info(`Crossbar request complete, found ${result.data.length} cdrs`);

        return result.data;
    }

    async getRecordings() {
        this.logger.info(`Getting recordings from Crossbar`);

        const url = `${this.apiUrl}/accounts/${this.accountId}/recordings`;

        const httpOptions = {
            uri: url,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': this.authToken
            },
            json: true
        };

        this.logger.info(`Sending request to Crossbar: ${JSON.stringify(httpOptions)}`);

        const result = await request(httpOptions);

        return result;
    }

    async getRecording(recordingId) {
        this.logger.info(`Getting recordings from Crossbar`);

        const url = `${this.apiUrl}/accounts/${this.accountId}/recordings/${recordingId}`;

        const httpOptions = {
            uri: url,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': this.authToken
            },
            json: true
        };

        this.logger.info(`Sending request to Crossbar: ${JSON.stringify(httpOptions)}`);

        const result = await request(httpOptions);

        return result;
    }
}

module.exports = CrossbarService;
