/* eslint-disable prettier/prettier */
/* eslint global-require: off, import/no-extraneous-dependencies: off */

const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');

module.exports = {
  plugins: [require('tailwindcss'), require('autoprefixer')],
};
