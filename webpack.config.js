const path = require('path')
const ROOT = path.resolve(__dirname, 'src/app')
const DESTINATION = path.resolve(__dirname, 'dist')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
const packageJson = require('./package.json')

module.exports = {
    context: ROOT,
    mode: 'development',
    entry: {
        main: './main.ts',
    },
    experiments: {
        topLevelAwait: true,
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: 'style.[contenthash].css',
            insert: '#css-anchor',
        }),
        new HtmlWebpackPlugin({
            //hash: true,
            title: 'Python playground',
            template: './index.html',
            filename: './index.html',
            baseHref: `/applications/${packageJson.name}/${packageJson.version}/dist/`,
        }),
        new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: './bundle-analysis.html',
            openAnalyzer: false,
        }),
    ],
    output: {
        filename: '[name].[contenthash].js',
        path: DESTINATION,
    },

    resolve: {
        extensions: ['.ts', '.js'],
        modules: [ROOT, 'node_modules'],
    },
    externals: [
        {
            lodash: "window['_']",
            rxjs: 'rxjs',
            'rxjs/operators': "window['rxjs']['operators']",
            '@youwol/flux-view': "window['@youwol/flux-view']",
            '@youwol/fv-tabs': "window['@youwol/fv-tabs']",
            '@youwol/cdn-client': "window['@youwol/cdn-client']",
            '@youwol/http-clients': "window['@youwol/http-clients']",
            '@youwol/os-core': "window['@youwol/os-core']",
        },
    ],
    module: {
        rules: [
            /****************
             * PRE-LOADERS
             *****************/
            {
                enforce: 'pre',
                test: /\.js$/,
                use: 'source-map-loader',
            },
            /****************
             * LOADERS
             *****************/
            {
                test: /\.ts$/,
                exclude: [/node_modules/],
                use: 'ts-loader',
            },
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
        ],
    },
    devtool: 'source-map',
    devServer: {
        static: {
            directory: path.join(__dirname, './src'),
        },
        compress: true,
        port: 3012,
    },
}
