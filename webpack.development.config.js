const path = require('path');
const webpack = require('webpack');
const VueLoaderPlugin = require('vue-loader/lib/plugin');

module.exports = {
    mode: 'development',
    entry: {
        app: [
            'whatwg-fetch',
            'webpack/hot/dev-server',
            'webpack-dev-server/client?http://dev.lighterpack.com:8080/',
            './client/css/lighterpack.scss',
            './client/lighterpack.js',
        ],
        share: [
            './client/css/share.scss',
            'webpack/hot/dev-server',
            'webpack-dev-server/client?http://dev.lighterpack.com:8080/',
        ],
    },
    output: {
        path: path.resolve(__dirname, './dist'),
        publicPath: '/dist/',
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader',
            },
            {
                test: /\.js$/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                query: {
                    presets: ['@babel/preset-env'],
                },
            },
            {
                test: /\.(png|jpg|gif|svg)$/,
                loader: 'file-loader',
                options: {
                    name: '[name].[ext]?[hash]',
                },
            },
            {
                test: /\.scss$/,
                loader: ['vue-style-loader', 'css-loader', 'sass-loader'],
            },
        ],
    },
    resolve: {
        alias: {
            vue$: 'vue/dist/vue.esm.js',
        },
    },
    devServer: {
        historyApiFallback: true,
        noInfo: true,
        hot: true,
    },
    performance: {
        hints: false,
    },
    devtool: '#eval-source-map',
    plugins: [
        new VueLoaderPlugin(),
        new webpack.HotModuleReplacementPlugin(),
    ],
};
