import {config} from './config';
import * as moment from 'moment';
import {Moment} from 'moment';
import { string } from 'joi';

export class Cache {
    public cache = new Map<string, Moment>();

    constructor() {
        setInterval(() => this.clean(), config.cache.cleanInterval);
    }

    public set(key: string, value: Moment) {
        this.cache.set(key, value);
    }

    public hasKey(key: string) {
        return this.cache.has(key);
    }

    public clean() {
        const entries = [...this.cache.entries()];
        entries.forEach(([key, value]) => {
            const duration = moment.duration(moment.utc().diff(value));
            if (duration.asMilliseconds() > config.cache.cleanInterval) {
                this.deleteKey(key);
            }
        });
    }

    public deleteKey(key: string) {
        this.cache.delete(key);
    }
}
