import http from 'http';

import config from 'config';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { logger } from './server/log.js';
import endpoints from './server/endpoints.js';
import moderationEndpoints from './server/moderation-endpoints.js';
import views, { hasBuiltAssets } from './server/views.js';

// Backstop: a rejected promise that escapes a handler (e.g. a transient DB
// error on a detached async call) would otherwise terminate the process on
// modern Node. Log it and keep serving.
process.on('unhandledRejection', (err) => {
    logger.error({ message: 'Unhandled promise rejection', err: { message: err?.message, stack: err?.stack } });
});

const app = express();

// Trust exactly one hop - nginx - rather than the whole X-Forwarded-For chain.
// Trusting the chain means req.ip is the leftmost entry, which the client sets
// itself: anyone could forge the address in the access log below, and any future
// per-IP throttle would be a header away from useless. This number is the count
// of proxies in front of node, so adding a CDN ahead of nginx makes it 2.
app.set('trust proxy', 1);

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

app.use((req, _res, next) => {
    req.cookies = {};
    for (const part of (req.headers.cookie || '').split(';')) {
        const [key, ...val] = part.trim().split('=');
        if (key) req.cookies[decodeURIComponent(key)] = decodeURIComponent(val.join('='));
    }
    next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({
    extended: true,
    limit: '50mb',
}));

app.use(express.static(`${import.meta.dirname}/public/`, { maxAge: oneDay }));

const server = http.createServer(app);

// Dev without a build: run Vite in-process so its modules and HMR socket share
// this origin. A production box with a failed build must fall through to the
// broken-asset path rather than quietly start compiling source on demand.
if (!hasBuiltAssets && config.get('environment') !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
        root: import.meta.dirname,
        appType: 'custom',
        server: { middlewareMode: true, hmr: { server } },
    });
    app.use(vite.middlewares);
}

app.use('/', endpoints);
app.use('/', moderationEndpoints);
app.use('/', views);

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = err.status || err.statusCode || 500;
    logger.error({
        requestid: req.uuid,
        message: 'Unhandled request error',
        status,
        err: { message: err.message, stack: err.stack, type: err.type },
        url: req.originalUrl,
        method: req.method,
    });
    if (res.headersSent) return;
    if (status < 500) {
        return res.status(status).json({ message: 'Invalid request.' });
    }
    return res.status(500).json({ message: 'An unexpected error occurred.' });
});

logger.info({ message: 'Starting up Lighterpack...' });
server.listen(config.get('port'));
logger.info({ message: `Listening on ${config.get('port')}` });