#!/usr/bin/env node
'use strict';

var smaasApi = require('./app/api'),
  _ = require('underscore'),
  cors = require('cors');

function initExpress (opts, cb) {
  opts = opts || {};
  opts.port = opts.port || process.env.PORT || 8002;

  var express = require('express'),
  path = require('path'),
  logger = require('morgan'),
  app = express();

  app.use(logger('dev'));
  
  // buffer the body
  app.use(function(req, res, next) {
    // Don't buffer for tarballs
    if(req.is('application/x-tar')) return next();

    req.body = '';
    req.on('data', function(data) {
      return req.body += data;
    });
    return req.on('end', next);
  });
  
  var websiteUrl = 'http://localhost:' + opts.port;
  
  if (process.env.WEBSITE_URL) {
    websiteUrl = process.env.WEBSITE_URL;
  } else {
    console.log('Missing "WEBSITE_URL" variable.');
  }

  app.use(cors({
    origin: websiteUrl,
    exposedHeaders: ['WWW-Authenticate', 'Location', 'X-Configuration']
  }));

  app.set('views', path.join(__dirname, './views'));
  app.engine('html', require('ejs').renderFile);
  app.use(express.static(path.join(__dirname, './public')));

  opts.app = app;

  initApi(opts, cb);
}

function initApi(opts, cb){
  opts = opts || {};
  opts.port = opts.port || process.env.PORT || 8002;
  opts.basePath = opts.basePath || '/api/v1';
  opts.dbProvider = opts.dbProvider || require('SCXMLD-simple-database-provider');
  opts.simulationProvider = opts.simulationProvider || require('SCXMLD-simple-simulation-provider');
  opts.middlewares = opts.middlewares || [];

  if(!opts.app) {
    return cb(new Error('Missing express app'));
  }

  var db = opts.dbProvider();

  db.init(function (err) {
    if(err) return cb(err);

    console.log('Db initialized');

    // Initialize the api
    var simulation = opts.simulationProvider(db);

    var api = smaasApi(simulation, db);

    var smaasJSON = require('smaas-swagger-spec');

    smaasJSON.host = process.env.SMAAS_HOST_URL || ('localhost' + ':' + opts.port);
    smaasJSON.basePath = opts.basePath;

    opts.app.get('/smaas.json', function (req, res) {
      res.status(200).send(smaasJSON);
    });

    opts.app.get('/:username/smaas.json', function (req, res) {
      var userSmaasJSON = _.clone(smaasJSON);

      userSmaasJSON.basePath = userSmaasJSON.basePath.replace(':username', req.params.username);

      res.status(200).send(userSmaasJSON);
    });

    opts.app.get(smaasJSON.basePath + '/:StateChartName/:InstanceId/_viz', api.instanceViz);
    opts.app.get(smaasJSON.basePath + '/:StateChartName/_viz', api.statechartViz);

    function methodNotImplementedMiddleware(req, res){
      return res.send(501, { message: 'Not implemented' });
    }

    Object.keys(smaasJSON.paths).forEach(function(endpointPath){
      var endpoint = smaasJSON.paths[endpointPath];
      var actualPath = smaasJSON.basePath + endpointPath.replace(/{/g, ':').replace(/}/g, '');

      Object.keys(endpoint).forEach(function(methodName){
        var method = endpoint[methodName];

        var handler = api[method.operationId] || methodNotImplementedMiddleware;
        switch(methodName) {
          case 'get': {
            opts.app.get(actualPath, opts.middlewares, handler);
            break;
          }
          case 'post': {
            opts.app.post(actualPath, opts.middlewares, handler);
            break;
          }
          case 'put': {
            opts.app.put(actualPath, opts.middlewares, handler);
            break;
          }
          case 'delete': {
            opts.app.delete(actualPath, opts.middlewares, handler);
            break;
          }
          default:{
            console.log('Unsupported method name:', methodName);
          }
        }
      });
    });

    opts.app.use(function(req, res) {
      res.status(404).send('Can\'t find ' + req.path);
    });

    cb(null, opts);
  });
}


if(require.main === module) {
  var opts = {};
  if(process.env.SIMULATION_PROVIDER){
    opts.simulationProvider = require(process.env.SIMULATION_PROVIDER);
  }
  initExpress(opts, function (err, opts) {
    console.log('Starting server on port:', opts.port);
    if(err) throw err;

    opts.app.listen(opts.port, function () {
      console.log('Server started');
    });
  });
} else {
  module.exports = {
    initApi: initApi,
    initExpress: initExpress
  };
}
