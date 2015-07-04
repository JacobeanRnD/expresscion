#!/usr/bin/env node
'use strict';

var smaasApi = require('./app/api'),
  cors = require('cors'),
  scxml = require('scxml'),
  fs = require('fs'),
	validate = require('./app/validate-scxml').validateCreateScxmlRequest;

//CLI: scxmld statechartName [instanceId]
//scxmld.initApi({pathToModel : 'index.scxml', instanceId : null || instanceId})

function initExpress (opts, cb) {
  opts = opts || {};
  opts.port = opts.port || process.env.PORT || 8002;

  var express = require('express'),
  path = require('path'),
  logger = require('morgan'),
  app = express();

  app.use(logger('dev'));
  
  // buffer the body
  app.use(function(req, res, next) {
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
  app.use(express.static(path.join(__dirname, './node_modules/expresscion-portal/app')));
  app.use(express.static(path.join(__dirname, './public')));

  opts.app = app;

  initApi(opts, cb);
}

function initApi(opts, cb){
  opts = opts || {};
  opts.port = opts.port || process.env.PORT || 8002;
  opts.basePath = opts.basePath || '/api/v3';

  if(process.env.SIMULATION_PROVIDER){
    opts.simulationProvider = require(process.env.SIMULATION_PROVIDER);
  }

  opts.middlewares = opts.middlewares || [];

  process.env.SEND_URL = process.env.SEND_URL || ('http://localhost:' + opts.port + opts.basePath + '/');

  if(!opts.app) {
    return cb(new Error('Missing express app'));
  }

  var totalRequestCount = 0;
  opts.app.use(function (req, res, next) {
    //We are providing an id to each request and response
    //So we can unregister "_changes" listeners on stateless servers
    req.uniqueId = res.uniqueId = totalRequestCount++;

    next();
  });

  console.log('here');
  fs.readFile(opts.pathToModel, 'utf8', function (err, scxmlString) {
    if(err) throw err;

    validate(scxmlString, function(scxmlSchemaErrors) {   
      if(scxmlSchemaErrors) throw scxmlSchemaErrors;

      scxml.pathToModel(opts.pathToModel, function(err, model){

        var modelName = process.env.APP_NAME || model.meta.name;

        // Initialize the api
        //var simulation = opts.simulationProvider(db, model, modelName );

        var api = smaasApi( model, scxmlString, modelName );

        var smaasJSON = require('smaas-swagger-spec');

        smaasJSON.host = process.env.HOST || ('localhost' + ':' + opts.port);
        smaasJSON.basePath = opts.basePath;

        opts.app.get('/smaas.json', function (req, res) {
          res.status(200).send(smaasJSON);
        });

        opts.app.get(smaasJSON.basePath + '/:InstanceId/_viz', api.instanceViz);
        opts.app.get(smaasJSON.basePath + '/_viz', api.statechartViz);

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
    });
  });
}

if(require.main === module) {
  var opts = {};
  opts.pathToModel = process.argv[2] || 'main.scxml';

  initExpress(opts, function (err, opts) {
    if(err) throw err;

    console.log('Starting server on port:', opts.port);
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
