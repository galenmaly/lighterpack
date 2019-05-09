const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const compression = require('compression');
const config = require('config');
const express = require('express');

const app = express();
app.enable('trust proxy');
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
const views = require('./server/views.js');

app.use('/', endpoints);
app.use('/', views);

console.log('-------');
console.log(new Date().toString().substr(0, 24));

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
        console.log(`Listening on [${bind}]:${config.get('port')}`);
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
            return console.log(err);
        }

        console.log(`Webpack dev server listening on port ${config.get('devServerPort')}`);
    });
}
