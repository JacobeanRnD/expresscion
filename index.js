#!/usr/bin/env node
'use strict';

var express = require("express"),
  url = require("url"),
  cors = require("cors"),
  path = require('path'),
  fs = require('fs'),
  yaml = require('js-yaml'),
  app = express(),
  api = require('./providers/common/api');

// TODO: Parameterize this so we can use npm install scxmld-docker plug-in.
var simulationServer = require('./providers/stateful/docker');
var database = require('./providers/common/in-memory-db');

// Initialize the api
api = api(simulationServer, database());

var smaasJSON = yaml.safeLoad(fs.readFileSync(__dirname + '/smaas.yml','utf8'));

var port = process.env.PORT || 8002;

smaasJSON.host = process.env.SMAAS_HOST_URL || ('localhost' + ':' + port);

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

app.get('/smaas.json', function (req, res) {
  res.status(200).send(smaasJSON);
});

app.get('/api/v1/:StateChartName/:InstanceId/_viz', api.instanceViz);
app.get('/api/v1/:StateChartName/_viz', api.statechartViz);
app.all('/api/v1/:StateChartName/_handlers/:HandlerName/*', api.httpHandlerAction);

function methodNotImplementedMiddleware(req, res){
  return res.send(501, {message : "Not implemented"});
}

Object.keys(smaasJSON.paths).forEach(function(endpointPath){
  var endpoint = smaasJSON.paths[endpointPath];
  var actualPath = smaasJSON.basePath + endpointPath.replace(/{/g, ':').replace(/}/g, '');

  Object.keys(endpoint).forEach(function(methodName){
    var method = endpoint[methodName];

    var handler = api[method.operationId] || methodNotImplementedMiddleware;
    switch(methodName) {
      case 'get': {
        app.get(actualPath, api[method.operationId]);
        break;
      }
      case 'post': {
        app.post(actualPath, api[method.operationId]);
        break;
      }
      case 'put': {
        app.put(actualPath, api[method.operationId]);
        break;
      }
      case 'delete': {
        app.delete(actualPath, api[method.operationId]);
        break;
      }
      default:{
        console.log('Unsupported method name:', methodName);
      }
    }
  });
});

app.use(function(req, res, next) {
  res.status(404).send('Can\'t find ' + req.path);
});

if(require.main === module) {
  console.log('Starting server on port:', port);
  app.listen(port, function () {
    console.log('Server started');
  });
} else {
  module.exports = app;  
}
