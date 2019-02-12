const config = require('./config');
const winston = require('winston');
require('winston-daily-rotate-file');

const consoleErrorStackFormat = winston.format.printf((info) => {
    const properties = Object.getOwnPropertyNames(info);

    if (info.message instanceof Object) {
        return `${info.timestamp} ${info.level} ${JSON.stringify(info.message)} : ${info.stack || ''}`;
    }

    let output = `${info.timestamp} ${info.level} ${info.message}`;
    for (let prop of properties) {
        if (prop === 'timestamp' || prop === 'level' || prop === 'message') {
            continue;
        }

        output += ` ${prop}: ${info[prop]}`
    }
    return output;
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

module.exports = winston.createLogger({
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
        new winston.transports.DailyRotateFile(
            {
                name: 'app-json-transport',
                filename: `${config.logger.directory}/app-%DATE%.log`,
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
