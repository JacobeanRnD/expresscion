'use strict';

var scxml = require('scxml'),
  sse = require('./sse'),
  uuid = require('uuid'),
  http = require('http');

var models = {};
var instances = {};
var instanceSubscriptions = {};

module.exports = function (model, scxmlString, modelName) {
  var api = {};

  function createNamedInstance(instanceId, res) {
    var instance = new scxml.scion.Statechart(model, { sessionid: instanceId });

    instances[instanceId] = instance;

    res.setHeader('Location', instanceId);

    res.status(201).send({ name: 'success.create.instance', data: { id: instanceId }});
  };

  api.getStatechartDefinition = function(req, res){
    res.type('application/scxml+xml').status(200).send(scxmlString);
  };

  api.createInstance = function(req, res) {
    var instanceId = uuid.v1();
    createNamedInstance(instanceId, res);
  };

  api.createNamedInstance = function(req, res) {
    var instanceId = req.params.InstanceId;
    if(instances[instanceId]){
      return res.status(409).send({ name: 'error.creating.instance', data: { message: 'InstanceId is already associated with an instance' }});
    }

    createNamedInstance(instanceId, res);
  };

  api.getInstances = function(req, res) {
    res.send({ name: 'success.get.instances', data: {instances : Object.keys(instances)}});
  };

  api.getInstance = function(req, res){
    getInstance(req, res, function(instanceId, instance){
      res.send({ name: 'success.get.instance', data: { instance: { snapshot: instance.getSnapshot() }}});
    });
  };

  api.sendEvent = function(req, res) {
    getInstance(req, res, function(instanceId, instance){
      var event;

      try {
         event = JSON.parse(req.body);
      } catch(e) {
        return res.status(400).send({ name: 'error.parsing.json', data: { message: 'Malformed event body.' }});
      }

      try {
        if(event.name === 'system.start') {
          instance.start();
        } else {
          instance.gen(event);
        }
      } catch(e){
        return res.status(500).send({ name: 'error.sending.event', data: e.message});
      }

      var snapshot = instance.getSnapshot();
      res.setHeader('X-Configuration',JSON.stringify(snapshot[0]));
      //TODO: handle custom data
      return res.send({ name: 'success.event.sent', data: { snapshot: snapshot }});
    });
  };

  function getInstance(req, res, done){
    var instanceId = req.params.InstanceId;
    var instance = instances[instanceId];
    if(instance){
      done(instanceId, instance);
    } else {
      res.status(404).send({'name':'error.instance.not.found'});
    }
  }

  api.deleteInstance = function(req, res){
    getInstance(req, res, function(instanceId, instance){
      delete instances[instanceId];
      res.send({ name: 'success.deleting.instance', data: { message: 'Instance deleted successfully.' }});
    });
  };

  api.getInstanceChanges = function(req, res){
    getInstance(req, res, function(instanceId, instance){
      sse.initStream(req, res, function(){});

      instanceSubscriptions[instanceId] = instanceSubscriptions[instanceId] || [];

      instanceSubscriptions[instanceId].push(res);

      instance.on('*',function(name, data){
        res.write('event: ' + name + '\n');
        res.write('data: ' + data + '\n\n');
      });
    });
  };

  //TODO: move these out
  api.instanceViz = function (req, res) {
    var instanceId = util.getInstanceId(req);

    getInstance(req, res, function(instanceId, instance){
      res.render('viz.html', {
        type: 'instance'
      });
    });
  };

  api.statechartViz = function (req, res) {
    res.render('viz.html', {
      type: 'statechart'
    });
  };

  api.getEventLog = function (req, res) {
    res.status(501).send({'name':'Not implemented'});
  };

  return api;
};
