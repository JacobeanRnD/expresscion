'use strict';

var scxml = require('scxml');
var uuid = require('uuid');
var docker = require('./docker');
var archiver = require('archiver');
var http = require('http');
var request = require('request');
var createSandbox = require('./ScionSandbox');

var compiledScxmlModuleName = 'compiled-scxml.js';
var dockerfileStr = 
  'FROM    jbeard4/stateful-docker-server-image\n' + 
  'COPY ' + compiledScxmlModuleName + ' /src/' + compiledScxmlModuleName;

module.exports = function(db){

  var api = {};

  api.createStatechart = function (scName, scxmlString, done) {
    scxml.documentStringToModel(null, scxmlString, function(err, model){
      if(err) return done(err);

      var archive = archiver.create('tar');
      var chartName = scName || model.meta.name || uuid.v1();

      var compiledModuleStr = 'module.exports = ' + model.toString() + ';';

      archive.append(dockerfileStr, {name : 'Dockerfile'}); 
      archive.append(compiledModuleStr, {name : compiledScxmlModuleName}); 

      docker.buildImage(archive, {t: chartName, isStream : true}, function (err, response){
        if(err) return done(err);

        var str = '';
        response.on('data',function(s){
          str += s.toString(); 
        });
        response.on('end',function(){
          done(null, chartName);
        });

        //TODO: broadcastDefinitionChange(scxmlString);
      });

      archive.finalize();
    });
  };


  api.createInstance = function (chartName, maybeInstanceId, done) {
    //create a container
    createSandbox({image: chartName}, function (err, sandbox, initialSnapshot) {
      if(err) return done(err);

      var instanceId = maybeInstanceId || sandbox.id || uuid.v1();
      var instanceLocation = chartName  + '/' + instanceId;

      db.set(instanceLocation, JSON.stringify(sandbox), function(err){
        if(err) return done(err);

        done(null, instanceLocation);
      });
    }); 
  };


  api.startInstance = function (id, done) {
    if(!id) throw new Error('id not specified');
    db.get(id, function(err, containerInfo){
      if(err) return done(err);
      request({
        url : 'http://' + containerInfo.ip + ':3000/start',
        method : 'POST',
        json : true
      },function(err, response, body){
        if(err) return done(err);

        return done(null, body);
      });
    });
  };

  api.getInstanceSnapshot = function (id, done) {
    db.get(id, function(err, containerInfo){
      if(err) return done(err);
      request({
        url : 'http://' + containerInfo.ip + ':3000/',
        method : 'GET',
        json : true
      },function(err, response, body){
        if(err) return done(err);

        return done(null, body);
      });
    });
  };

  api.sendEvent = function(id, event, done){
    db.get(id, function(err, containerInfo){
      if(err) return done(err);
      request({
        url : 'http://' + containerInfo.ip + ':3000/',
        method : 'POST',
        json : event,
      },function(err, response, body){
        if(err) return done(err);

        return done(null, body);
      });
    });
  };

  api.deleteStatechart = function(chartName, done){
    var image = docker.getImage(chartName);
    image.remove(function(err){
      if(err) return done(err);
      done();
    });
  };

  api.deleteInstance = function(id, done){
    db.get(id, function(err, containerInfo){
      if(err) return done(err);

      var container = docker.getContainer(containerInfo.id);
      container.stop(function(err){
        if(err) return done(err);
        container.remove(function(err){
          if(err) return done(err);
          db.del(id,function(err){
            if(err) return done(err);

            done();
          });
        });
      });
    });
  };

  api.registerListener = function(id, res, done){
    db.get(id, function(err, containerInfo){
      if(err) return done(err);
      var request = http.request({
          protocol : 'http:',
          hostname : containerInfo.ip,
          port : 3000,
          path : '/_changes'
        }, function(response) {
          console.log('STATUS: ' + res.statusCode);
          console.log('HEADERS: ' + JSON.stringify(res.headers));
          response.pipe(res);
      });
      request.end();
    });
  };

  api.unregisterListener = function (id, listener, done) {
    //TODO
    done();
  };

  return api;
};
