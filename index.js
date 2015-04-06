#!/usr/bin/env node
'use strict';

  var fs = require('fs'),
  yaml = require('js-yaml'),
  api = require('./providers/common/api');

function initExpress (cb) {
  var express = require('express'),
  path = require('path'),
  app = express();

  // buffer the body
  app.use(function(req, res, next) {
    req.body = '';
    req.on('data', function(data) {
      return req.body += data;
    });
    return req.on('end', next);
  });

  app.set('views', path.join(__dirname, './views'));
  app.engine('html', require('ejs').renderFile);
  app.use(express.static(path.join(__dirname, './public')));

  var database = require('./providers/databases/postgres-db');
  var simulationServer = require('./providers/stateful/simple')(database);

  initApi({
    app: app,
    simulationServer: simulationServer,
    database: database
  }, cb);
}

function initApi(opts, cb){
  opts = opts || {};
  opts.basePath = opts.basePath || '/api/v1/';
  opts.port = opts.port || process.env.PORT || 8002;

  if(!opts.app || opts.database || opts.simulationServer) {
    return cb(new Error('Missing app or database or simulationServer'));
  }

  opts.database(function (err) {
    if(err) return cb(err);

    console.log('Db initialized');

    // Initialize the api
    api = api(opts.simulationServer, opts.database);

    var smaasJSON = yaml.safeLoad(fs.readFileSync(__dirname + '/smaas.yml','utf8'));
    smaasJSON.host = process.env.SMAAS_HOST_URL || ('localhost' + ':' + opts.port);
    smaasJSON.basePath = opts.basePath;

    opts.app.get('/smaas.json', function (req, res) {
      res.status(200).send(smaasJSON);
    });

    opts.app.get(opts.basePath + ':StateChartName/:InstanceId/_viz', api.instanceViz);
    opts.app.get(opts.basePath + ':StateChartName/_viz', api.statechartViz);

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
            opts.app.get(actualPath, handler);
            break;
          }
          case 'post': {
            opts.app.post(actualPath, handler);
            break;
          }
          case 'put': {
            opts.app.put(actualPath, handler);
            break;
          }
          case 'delete': {
            opts.app.delete(actualPath, handler);
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
  initExpress(function (err, opts) {
    console.log('Starting server on port:', opts.port);
    if(err) throw err;

    opts.app.listen(opts.port, function () {
      console.log('Server started');
    });
  });
} else {
  module.exports.api = api;
}
