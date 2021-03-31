const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const compression = require('compression');
const config = require('config');
const express = require('express');
const morgan = require('morgan');
const uuid = require('uuid');

const { logger } = require('./server/log.js');

morgan.token('username', function getUsername (req) {
    return req.lighterpackusername
});


morgan.token('requestid', function getUsername (req) {
    return req.uuid
});

const app = express();
app.enable('trust proxy');

app.use(function (req, res, next) {
    req.uuid = uuid.v4();
    next();
});

app.use(morgan(function (tokens, req, res) {
    return JSON.stringify({
        'timestamp': tokens.date(req, res, 'iso'),
        'requestid': tokens.requestid(req, res),
        "remote-addr": tokens['remote-addr'](req, res),
        'method': tokens.method(req, res),
        'http-version': tokens['http-version'](req, res),
        'user-agent': tokens['user-agent'](req, res),
        'url': tokens.url(req, res),
        'status': tokens.status(req, res),
        'referrer': tokens.referrer(req, res),
        'content-length': tokens.res(req, res, 'content-length'),
        'response-time': tokens['response-time'](req, res),
        'username': tokens.username(req, res),
    })
}, { stream: logger.stream.write }));

const oneDay = 86400000;

app.use(compression());
app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({
    extended: true,
    limit: '50mb',
}));

app.use(express.static(`${__dirname}/public/`, { maxAge: oneDay }));
const endpoints = require('./server/endpoints.js');
const moderationEndpoints = require('./server/moderation-endpoints.js');
const views = require('./server/views.js');

app.use('/', endpoints);
app.use('/', moderationEndpoints);
app.use('/', views);

logger.info("Starting up Lighterpack...");

if (config.get('environment') === 'production') {
    webpackConfig = require('./webpack.config');
} else {
    webpackConfig = require('./webpack.development.config');
}

webpackCompiler = webpack(webpackConfig);

// Default port is 3000; we can have multiple bindings
config.get('bindings').map(
    (bind) => {
        app.listen(config.get('port'), bind);
        logger.info(`Listening on [${bind}]:${config.get('port')}`);
    },
);

if (config.get('environment') !== 'production') {
    new WebpackDevServer(webpack(webpackConfig), {
        historyApiFallback: true,
        disableHostCheck: true,
        publicPath: webpackConfig.output.publicPath,
        hot: true,
        proxy: {
            '*': {
                target: `http://localhost:${config.get('port')}`,
                secure: false,
                changeOrigin: true,
            },
        },
        stats: {
            cached: false,
            cachedAssets: false,
            colors: { level: 2 },
        },
        watchOptions: {
            aggregateTimeout: 300,
            poll: 1000,
        },
    }).listen(config.get('devServerPort'), (err, result) => {
        if (err) {
            return logger.info(err);
        }

        logger.info(`Webpack dev server listening on port ${config.get('devServerPort')}`);
    });
}
