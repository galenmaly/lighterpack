import cookieParser from 'cookie-parser';
import config from 'config';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { logger } from './server/log.js';
import endpoints from './server/endpoints.js';
import moderationEndpoints from './server/moderation-endpoints.js';
import views from './server/views.js';

const app = express();
app.enable('trust proxy');

app.use((req, res, next) => {
    req.uuid = uuidv4();
    const startTime = Date.now();
    res.on('finish', () => {
        logger.info({
            requestid: req.uuid,
            'remote-addr': req.ip,
            method: req.method,
            'http-version': `${req.httpVersionMajor}.${req.httpVersionMinor}`,
            'user-agent': req.headers['user-agent'],
            url: req.originalUrl,
            status: res.statusCode,
            referrer: req.headers.referer || req.headers.referrer,
            'content-length': res.getHeader('content-length'),
            'response-time': Date.now() - startTime,
            username: req.lighterpackusername,
        });
    });
    next();
});

const oneDay = 86400000;

app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({
    extended: true,
    limit: '50mb',
}));

app.use(express.static(`${import.meta.dirname}/public/`, { maxAge: oneDay }));

app.use('/', endpoints);
app.use('/', moderationEndpoints);
app.use('/', views);

logger.info('Starting up Lighterpack...');

config.get('bindings').map((bind) => {
    app.listen(config.get('port'), bind);
    logger.info(`Listening on [${bind}]:${config.get('port')}`);
});
