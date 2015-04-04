'use strict';

var scxml = require('scxml');
var uuid = require('uuid');
var vm = require('vm');
var validate = require('./validate-scxml').validateCreateScxmlRequest;
var sse = require('./sse');

var definitions = {};
var compiledDefinitions = {};
var definitionToInstances = {};
var instances = {};
var statechartDefinitionSubscriptions = {};
var events = {};
var httpHandlers = {};

module.exports = function (simulation, database) {
  var api = {};

  function createStatechartDefinition(req,res,scName) {
    var scxmlString, handler;

    if(req.headers['content-type'] === 'application/json') {
      try {
        var body = JSON.parse(req.body);
        scxmlString = body.scxml;
        handler = JSON.parse(body.handlers);
      } catch(e) {
        return res.status(400).send({ name : 'error.malformed.body', data : e.message });
      }
    } else {
      scxmlString = req.body;
    }

    validate(scxmlString, function(errors){

      if(errors) return res.status(400).send({ name : 'error.create', data : errors });

      scxml.documentStringToModel(null, scxmlString, function(err, model){
        var chartName = scName || model().name || uuid.v1();

        definitions[chartName] = scxmlString;
        compiledDefinitions[chartName] = model;
        definitionToInstances[chartName] = [];

        if(handler) {
          httpHandlers[chartName] = handler;
        }

        broadcastDefinitionChange(chartName);

        res.setHeader('Location', chartName);
        res.sendStatus(201);
      });
    });
  }

  api.createStatechartDefinition = function(req, res){
    createStatechartDefinition(req,res);
  };

  api.createOrUpdateStatechartDefinition = function(req, res){
    createStatechartDefinition(req, res, req.params.StateChartName);
  };

  function createInstance(chartName, instanceId){
    instanceId = chartName  + '/' + (instanceId || uuid.v1());
    var model = compiledDefinitions[chartName];

    if(!model) return { error: { statusCode: 404 } };

    var instance = new scxml.scion.Statechart(model);
    var initialConfiguration = instance.start();

    //update data stores
    var map = definitionToInstances[chartName] = definitionToInstances[chartName] || [];
    map.push(instanceId);
    instances[instanceId] = instance;

    return {
      instance: instance,
      id: instanceId,
      initialConfiguration: initialConfiguration
    };
  }

  api.createInstance = function(req, res){
    api.createNamedInstance(req, res);
  };

  api.createNamedInstance = function(req, res){
    var instanceResult = createInstance(req.params.StateChartName, req.params.InstanceId);
    if(instanceResult.error) return res.sendStatus(instanceResult.error.statusCode);

    res.setHeader('Location', instanceResult.id);
    res.setHeader('X-Configuration',JSON.stringify(instanceResult.initialConfiguration));

    res.sendStatus(201);
  };

  api.getStatechartDefinitions = function(req, res){
    res.json(Object.keys(definitions));
  };

  api.getStatechartDefinition = function(req, res){
    //1. fetch statechart definition
    var chartName = req.params.StateChartName;

    var model = definitions[chartName];
    
    if(!model) return res.sendStatus(404);

    res.status(200).send(model);
  };

  api.deleteStatechartDefinition = function(req, res){
    var chartName = req.params.StateChartName;

    if(!definitions[chartName]) return res.sendStatus(404);

    var success = delete definitions[chartName];
    definitionToInstances[chartName].forEach(function(instanceId){
      //TODO: stop running instances
      delete instances[instanceId];
    });
    delete definitionToInstances[chartName];
    
    if(success){
      res.sendStatus(200);
    }else{
      res.sendStatus(404);
    }
  };

  api.getInstances = function(req, res){
    var chartName = req.params.StateChartName;
      
    if(!definitions[chartName]) return res.sendStatus(404);

    res.status(200).send(definitionToInstances[chartName]);
  };

  api.getStatechartDefinitionChanges = function(req, res){
    var chartName = req.params.StateChartName;

    if(!definitions[chartName]) return res.sendStatus(404);

    var statechartDefinitionSubscription = 
      statechartDefinitionSubscriptions[chartName] = 
        statechartDefinitionSubscriptions[chartName] || [];
    statechartDefinitionSubscription.push(res);

    sse.initStream(req, res, function(){
      statechartDefinitionSubscription.splice(
        statechartDefinitionSubscription.indexOf(res), 1);
    });
  };

  function getInstance (id) {
    var instance = instances[id];
    if(!instance) return { error: { statusCode: 404 } };

    return instance;
  }

  api.getInstance = function(req, res){
    var chartName = req.params.StateChartName,
      instanceId = chartName + '/' + req.params.InstanceId,
      instance = getInstance(instanceId);

    if(instance.error) return res.sendStatus(instance.error.statusCode);
      
    res.status(200).send(instance.getSnapshot());
  };

  function sendEvent (instanceId, event) {
    var instance = instances[instanceId];

    if(!instance) return { error: { statusCode: 404 } };
    
    if(!events[instanceId]) events[instanceId] = [];

    var nextConfiguration = instance.gen(event); 
    
    events[instanceId].push({
      timestamp: new Date(),
      event: event,
      resultSnapshot: instance.getSnapshot()
    });

    return nextConfiguration;
  }

  api.sendEvent = function(req, res){
    var chartName = req.params.StateChartName,
      instanceId = chartName + '/' + req.params.InstanceId,
      event;

    try {
       event = JSON.parse(req.body);
    } catch(e) {
      return res.status(400).send(e.message);
    }

    var config = sendEvent(instanceId, event);
    
    if(config.error) return res.sendStatus(config.error.statusCode);

    res.setHeader('X-Configuration',JSON.stringify(config));
    res.sendStatus(200);
  };

  function deleteInstance (chartName, instanceId) {
    var success = delete instances[instanceId];
    var arr = definitionToInstances[chartName];
    arr.splice(arr.indexOf(instanceId), 1);

    return success;
  }

  api.deleteInstance = function(req, res){
    var chartName = req.params.StateChartName,
      instanceId = chartName + '/' + req.params.InstanceId;

    if(!instances[instanceId]) return res.sendStatus(404);

    var success = deleteInstance(chartName, instanceId);

    if(success){
      res.sendStatus(200);
    }else{
      res.sendStatus(404);
    }
  };

  api.getInstanceChanges = function(req, res){
    var chartName = req.params.StateChartName,
      instanceId = chartName + '/' + req.params.InstanceId;

    var instance = instances[instanceId];

    if(!instance) return res.sendStatus(404);

    var listener = {
      onEntry : function(stateId){
        res.write('event: onEntry\n');
        res.write('data: ' + stateId + '\n\n');
      },
      onExit : function(stateId){
        res.write('event: onExit\n');
        res.write('data: ' + stateId + '\n\n');
      }
      //TODO: spec this out
      // onTransition : function(sourceStateId,targetStatesIds){}
    };

    instance.registerListener(listener);

    sse.initStream(req, res, function(){
      instance.unregisterListener(listener);
    });
  };

  api.instanceViz = function (req, res) {
    var chartName = req.params.StateChartName,
      instanceId = chartName + '/' + req.params.InstanceId;

    var instance = instances[instanceId];

    if(!instance) return res.sendStatus(404);

    res.render('viz.html', {
      type: 'instance'
    });
  };

  api.statechartViz = function (req, res) {
    var chartName = req.params.StateChartName;

    if(!definitions[chartName]) return res.sendStatus(404);

    res.render('viz.html', {
      type: 'statechart'
    });
  };

  api.getEventLog = function (req, res) {
    var chartName = req.params.StateChartName,
      instanceId = chartName + '/' + req.params.InstanceId;

    var instance = instances[instanceId];

    if(!instance) return res.sendStatus(404);

    res.status(200).send(events[instanceId]);
  };

  api.httpHandlerAction = function (req, res) {
    var chartName = req.params.StateChartName,
      handlerName = req.params.HandlerName;

    if(httpHandlers[chartName] && httpHandlers[chartName][handlerName]) {
      var httpHandler = httpHandlers[chartName][handlerName];

      var vmContext = {
        req: req,
        res: res,
        chartName: chartName,
        console: console,
        require: require,
        scxml: {
          getInstance: function (id) {
            var instance = getInstance(normalizeInstanceId(chartName, id));
            return instance.error ? null : instance.getSnapshot();
          },
          createInstance: function (id) {
            var instanceResult = createInstance(chartName, id);
            return instanceResult.error ? null : instanceResult.id;
          },
          deleteInstance: function (id) {
            return deleteInstance(chartName, normalizeInstanceId(chartName, id));
          },
          send: function (id, event) {
            return sendEvent(normalizeInstanceId(chartName, id), event);
          }
        }
      };

      vm.createContext(vmContext);
      vm.runInContext('(' + httpHandler + '());', vmContext);
    } else {
      res.sendStatus(404);
    }
  };

  function normalizeInstanceId (chartName, id) {
    return id.indexOf(chartName + '/') !== 0 ? (chartName + '/' + id) : id;
  }

  function broadcastDefinitionChange(chartName){
    var statechartDefinitionSubscription = statechartDefinitionSubscriptions[chartName];
    if(statechartDefinitionSubscription) {
      statechartDefinitionSubscription.forEach(function(response) {
        response.write('event: onChange\n');
        response.write('data:\n\n');
      });
    }
  }

  return api;
};
