'use strict';

var mongoose = module.exports.db = require('mongoose');

var registerSchemas_ = function() {
  var schema = new mongoose.Schema({
    externalId: {type: String, required: true, unique: true},

    origin: {type: String, required: true, default: 'Reddit'},
    title: {type: String, required: true},
    link: {type: String, required: true},

    score: {type: Number, required: true},
    percentage: {type: Number, required: true},
    votes: {
      type: {
        ups: {type: Number},
        downs: {type: Number},
      },
    },

    date: {type: Date, default: Date.now},
  });

  mongoose.model('Post', schema, 'posts');
};

module.exports.connect = function(callback) {
  mongoose.connect('mongodb://localhost/redditFetch');

  mongoose.connection.on('error', function(err) {
    return callback(err);
  });

  return mongoose.connection.once('open', function() {
    registerSchemas_();

    return callback();
  });
};
