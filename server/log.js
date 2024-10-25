const winston = require('winston');

class TimestampFirst {
    constructor(enabled = true) {
        this.enabled = enabled;
    }

    transform(obj) {
        if (this.enabled) {
            return { timestamp: obj.timestamp, ...obj };
        }
        return obj;
    }
}

const enumerateErrorFormat = winston.format(info => {
    if (typeof(info) === 'object') {
        for (let key in info) {
            const value = info[key];
            if (value instanceof Error) {
                info[key] = {
                    message: value.message,
                    stack: value.stack
                };
            }
        }
    }

    return info;
}); 

const logger = winston.createLogger({
    format: winston.format.combine(
        enumerateErrorFormat(),
        winston.format.timestamp(),
        new TimestampFirst(true),
        winston.format.json(),
    ),
    transports: [new winston.transports.Console()],
});

const logWithRequest = function (req, data) {
    if (typeof (data) === 'string') {
        data = { message: data };
    }

    if (req && req.uuid) {
        logger.info({ ...data, requestid: req.uuid });
        return;
    }

    if (data.err) {
        logger.error(data);
        return;
    }
    
    logger.info(data);
};


module.exports = {
    logWithRequest,
    logger,
};
