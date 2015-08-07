'use strict';

var domain = require('domain');
var ejs = require('ejs');
var express = require('express');
var mongo = require('./mongo');

var buildMainPage = function(req, res) {
    var minDate = new Date();
    minDate.setDate(minDate.getDate() - 7);

    return mongo.db.model('Post').find({date: {$gte: minDate}}).sort({date: -1}).exec(function(err, posts) {
        if (err) {
            console.error(err.stack || err.message || err);
            return res.sendStatus(500);
        }

        res.locals.posts = posts;
        if (req.params && 'admin' === req.params.admin)
            res.locals.isAdmin = true;

        return res.render('index');
    });
};

var main = function() {
  console.log('Started application');

  var serverApp = express();

  serverApp.set('x-powered-by', false);

  // Rendering engine
  ejs.cache = require('lru-cache')(128);
  serverApp.engine('html', ejs.renderFile);
  serverApp.set('view engine', 'ejs');
  serverApp.set('views', __dirname + '/views');

  serverApp.use(require('morgan')('dev', {
    stream: {
      write: function(str) { return console.log(str.replace(/[\r\n]+/g, '')); },
      skip: function(req, res) { return 400 >= res.statusCode; },
    },
  }));

  var bodyParser      = require('body-parser');
  var compression     = require('compression');
  var cookieParser    = require('cookie-parser');
  var helmet          = require('helmet');

  // Security headers
  serverApp.use(helmet.xframe());
  serverApp.use(helmet.xssFilter());
  serverApp.use(helmet.nosniff());
  serverApp.use(helmet.nocache());

  serverApp.use(bodyParser.urlencoded({extended: true}));
  serverApp.use(bodyParser.json());
  serverApp.use(cookieParser());
  serverApp.use(compression());

  serverApp.use(function(req, res, next) {
    var reqd = domain.create();

    domain.active = reqd;
    reqd.add(req);
    reqd.add(res);

    reqd.on('error', next);
    return reqd.run(next);
  });

  serverApp.use(express.static('resources'));

  var router = express.Router();

  // Home
  router.get('/', buildMainPage);
  router.get('/:admin', buildMainPage);
  router.post('/post/:postId/deactivate', function(req, res) {
    return mongo.db.model('Post').findOneAndUpdate({_id: req.params.postId}, {$set: {active: false}}, function(err) {
      if (err) {
        console.err(err.stack || err.message || err);
        return res.sendStatus(500);
      }

      return res.sendStatus(200);
    });
  });
  router.get('/manifest.json', function(req, res) { return res.sendFile(__dirname + '/views/manifest.json'); });

  // Not found
  router.all('*',             function(req, res) { return res.sendStatus(404); });

  // Errors
  router.use(function(err, req, res) {
    console.error(err.stack || err.message || err);
    return res.sendStatus(500);
  });

  serverApp.use('/', router);

  return mongo.connect(function(err) {
    if (err)
      return process.exit(1);

    var port = 7337;
    serverApp.listen(port);
    console.log('Server listening on port ' + port);
    return ;
  });
};

main();
