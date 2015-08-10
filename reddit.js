'use strict';

var fs = require('fs');
var isAbsoluteUrl = require('is-absolute-url');
var request = require('request');

var global = {};
global.lastRequestDateFilePath = __dirname + '/_redditLastDate.txt';

// Last request date is stored in file
try { global.lastRequestDate = new Date(fs.readFileSync(global.lastRequestDateFilePath)); }
catch (e) { global.lastRequestDate = new Date('1970-01-01'); }

global.requestPaddTime = 3.5 * 1000; // ms, so 2s

var request_ = function(options, callback) {
  if (!isAbsoluteUrl(options.uri || options.url))
    options.baseUrl = 'http://api.reddit.com';
  // No custom user agent, only ours
  (options.headers ? options.headers : options.headers = {})['User-Agent'] = 'pampattitu.de Reddit fetcher';

  return request(options, function(err, res, body, warn) {
    if (err)
      return callback(err);
    if (200 !== res.statusCode)
      return callback(new Error('Wrong status code received'));

    if (warn)
      module.exports.warnLogger(warn);

    if ('string' === typeof body) {
      try { body = JSON.parse(body); }
      catch (e) { module.exports.warnLogger(warn); }
    }

    global.lastRequestDate = new Date();
    return fs.writeFile(global.lastRequestDateFilePath, global.lastRequestDate.toISOString(), function(err) {
      if (err)
        module.exports.warnLogger(err.message || err);

      return callback(null, body);
    });
  });
};

module.exports.request = function(options, callback) {
  var msDiff = new Date() - global.lastRequestDate;
  var padd = global.requestPaddTime - msDiff;
  if (0 > padd)
    padd = 0;

  var paddCallback = function(err, response) {
    return setTimeout(function() {
      return callback(err, response);
    }, padd);
  };

  return request_(options, paddCallback);
};
module.exports.warnLogger = function() {
    console.error.apply(console, [new Date().toISOString()].concat(arguments));
};
