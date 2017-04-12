const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const WebpackDevServer = require("webpack-dev-server");
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const compression = require('compression');
const config = require('config')
const express = require('express');

const app = express();
app.enable('trust proxy');
const oneDay = 86400000;

const extend = require('node.extend');

// Read in config file(s)

var webpackConfig;
var webpackCompiler;

if (true) { //TODO
    webpackConfig = require("./webpack.development.config");
} else {
    webpackConfig = require("./webpack.config");
}
webpackCompiler = webpack(webpackConfig);



//I'm pretty sure there's a better way to do this:
eval(fs.readFileSync(path.join(__dirname, 'public/js/sha3.js'))+'');

const pies = require("./client/pies.js");

app.use(express.static(__dirname + '/public', { maxAge: oneDay }));
app.use(compression());
app.use(cookieParser());
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({
  extended: true,
  limit: '50mb'
}));

const endpoints = require("./server/endpoints.js");
const views = require("./server/views.js");
app.use("/", endpoints);
app.use("/", views);

var d = new Date();
var time = d.toString().substr(0,24);
console.log("-------");
console.log(time);

// Default port is 3000; we can have multiple bindings
/*config.get('bindings').map(
    function(bind) {
        app.listen(config.get('port'),bind);
        console.log('Listening on [' + bind + ']:' +config.get('port'));
    }
)*/

if (true) {
    webpackConfig = require("./webpack.development.config");
} else {
    webpackConfig = require("./webpack.config");
}

app.listen(3000);

new WebpackDevServer(webpack(webpackConfig), {
    historyApiFallback: true,
    publicPath: webpackConfig.output.publicPath,
    hot: true,
    proxy: {
        "*": {
            target: "http://localhost:3000",
            secure: false,
            changeOrigin: true
        }
    },
    stats: { cached: false,
        cachedAssets: false,
        colors: { level: 2 } }
}).listen(8080, function(err, result) {
    if (err) {
        return console.log(err);
    }

    console.log("Webpack dev server listening on port 8080");
});