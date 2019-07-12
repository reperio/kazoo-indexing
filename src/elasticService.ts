import elasticsearch, { Client } from 'elasticsearch';
import { Logger } from 'winston';

export class ElasticService {
    private logger: any;
    private client: Client;

    constructor(config: any, logger: Logger) {
        this.logger = logger;

        this.logger.info(`Starting elastic client with config: ${JSON.stringify(config)}`);
        const elasticConfig = Object.assign({}, config);
        this.client = new elasticsearch.Client(elasticConfig);
    }

    public async createDocument(index: string, data: any) {
        this.logger.info('Creating document');
        const result = await this.client.index({
            index,
            type: '_doc',
            body: data,
            id: data.Id
        });

        this.logger.info('Elastic request sucessful.');
        return result;
    }

    public async bulkInsert(data: any) {
        this.logger.info(`Bulk inserting/updating ${data.length / 2} documents`);
        const result = await this.client.bulk({
            body: data
        });

        this.logger.debug(result);

        this.logger.info('Bulk insert finished');

        return result;
    }

    public async deleteDocument(index: string, id: string) {
        this.logger.info('Deleting document');

        const result = await this.client.deleteByQuery({
            index,
            body: {
                query: {
                    bool: {
                        filter: [
                            {
                                term: { _id: id }
                            }
                        ]
                    }
                }
            }
        });

        this.logger.info('Elastic request sucessful.');
        return result;
    }
}
