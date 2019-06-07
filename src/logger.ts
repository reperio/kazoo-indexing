import winston, { Logger } from 'winston';
import WinstonDailyRotateFile from 'winston-daily-rotate-file';
import _ from 'lodash';

const consoleErrorStackFormat = winston.format.printf(info => {
    const properties = Object.getOwnPropertyNames(info);
    const ignoredProperties = ['timestamp', 'level', 'message', '_object', 'annotate', 'reformat', 'data'];
    const objectProperties = ['details', 'output'];

    if (info.message as string | object instanceof Object) {
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

export const AppLogger = (config: any): Logger => {
    return winston.createLogger({
        level: config.logger.level,
        transports: [
            new winston.transports.Console(
                {
                    level: config.logger.level,
                    format: winston.format.combine(
                        winston.format.colorize(),
                        consoleErrorStackFormat
                    )
                }
            ),
            new WinstonDailyRotateFile(
                {
                    filename: `${config.logger.directory}/app-%DATE%.log`,
                    datePattern: 'YYYY-MM-DD'
                }
            )
        ],
        format: winston.format.combine(
            winston.format.timestamp(),
            parseErrorFormat(),
            winston.format.json()
        )
    });
};
