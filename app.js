import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import compression from 'compression';
import config from 'config';
import express from 'express';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';

import { logger } from './server/log.js';
import endpoints from './server/endpoints.js';
import moderationEndpoints from './server/moderation-endpoints.js';
import views from './server/views.js';

morgan.token('username', function getUsername(req) {
    return req.lighterpackusername;
});

morgan.token('requestid', function getRequestId(req) {
    return req.uuid;
});

const app = express();
app.enable('trust proxy');

app.use(function (req, res, next) {
    req.uuid = uuidv4();
    next();
});

app.use(morgan(function (tokens, req, res) {
    return JSON.stringify({
        'timestamp': tokens.date(req, res, 'iso'),
        'requestid': tokens.requestid(req, res),
        'remote-addr': tokens['remote-addr'](req, res),
        'method': tokens.method(req, res),
        'http-version': tokens['http-version'](req, res),
        'user-agent': tokens['user-agent'](req, res),
        'url': tokens.url(req, res),
        'status': tokens.status(req, res),
        'referrer': tokens.referrer(req, res),
        'content-length': tokens.res(req, res, 'content-length'),
        'response-time': tokens['response-time'](req, res),
        'username': tokens.username(req, res),
    });
}, { stream: logger.stream.write }));

const oneDay = 86400000;

app.use(compression());
app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({
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
