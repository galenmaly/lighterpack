const webpack = require("webpack");
const WebpackDevServer = require("webpack-dev-server");


var express = require('express');
var app = express();
app.enable('trust proxy');
var oneDay = 86400000;
var rootPath = __dirname + "/";

var extend = require('node.extend');

// Read in config file(s)
var config = require('config')

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compression = require('compression');

var webpackConfig;
var webpackCompiler;

if (true) { //TODO
    webpackConfig = require("./webpack.development.config");
} else {
    webpackConfig = require("./webpack.config");
}
webpackCompiler = webpack(webpackConfig);



//I'm pretty sure there's a better way to do this:
var fs = require("fs");
eval(fs.readFileSync(rootPath+'public/js/sha3.js')+'');
eval(fs.readFileSync(rootPath+'public/js/pies.js')+'');


const dataTypes = require("./client/dataTypes.js");
const Item = dataTypes.Item;
const Category = dataTypes.Category;
const List = dataTypes.List;
const Library = dataTypes.Library;


app.use(express.static(__dirname + '/public', { maxAge: oneDay }));
app.use(compression());
app.use(cookieParser());
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({
  extended: true,
  limit: '50mb'
}));



const endpoints = require("./server/endpoints.js");
app.use("/", endpoints);


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