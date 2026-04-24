const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const appTarget = process.env.APP_TARGET || 'perflab';

module.exports = {
  entry: `./src/${appTarget}/index.tsx`,
  target: 'electron-renderer',
  mode: 'development',
  devtool: 'source-map',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@core': path.resolve(__dirname, 'src/core'),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  output: {
    path: path.resolve(__dirname, 'build/renderer'),
    filename: 'bundle.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: `src/${appTarget}/index.html`,
      filename: 'index.html',
    }),
  ],
};
