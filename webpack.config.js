const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');

module.exports = {
    entry: {
        app: [
            'whatwg-fetch',
            './client/css/lighterpack.scss',
            './client/lighterpack.js',
        ],
        share: [
            './public/js/pies.js',
            './public/js/share.js',
            './client/css/share.scss',
        ],
    },
    output: {
        path: path.resolve(__dirname, './public/dist'),
        publicPath: '/dist/',
        filename: '[name].[chunkhash].js',
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
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader,
                    },
                    'css-loader',
                    {
                        loader: 'sass-loader',
                        options: {
                            implementation: require('sass'),
                        },
                    },
                ],
            },
        ],
    },
    resolve: {
        alias: {
            vue$: 'vue/dist/vue.esm.js',
        },
    },
    performance: {
        hints: false,
    },
    devtool: false,
    plugins: [
        new VueLoaderPlugin(),
        new webpack.LoaderOptionsPlugin({
            minimize: true,
        }),
        new MiniCssExtractPlugin({
            filename: '[name].[chunkhash].css',
        }),
        function () {
            this.plugin('done', (stats) => {
                const assetData = {
                    version: stats.toJson().chunks[0].hash,
                    files: stats.toJson().assetsByChunkName,
                };

                require('fs').writeFileSync(
                    path.join(__dirname, '/public/dist/', 'assets.json'), JSON.stringify(assetData),
                );
            });
        },
    ],
};
