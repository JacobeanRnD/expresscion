'use strict';

var uuid = require('uuid');
var vm = require('vm');
var async = require('async');
var validate = require('./validate-scxml').validateCreateScxmlRequest;
var sse = require('./sse');


var definitions = {};
var compiledDefinitions = {};
var definitionToInstances = {};
var statechartDefinitionSubscriptions = {};
var events = {};
var httpHandlers = {};

module.exports = function (simulation, database) {
  var api = {};

  function createStatechartDefinition(req, res, scName) {
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

      simulation.createStatechart(scxmlString, function (err, model) {
        if(err) return res.status(500).send(err);

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

  function createInstance(chartName, instanceId, done){
    instanceId = chartName  + '/' + (instanceId || uuid.v1());
    var model = compiledDefinitions[chartName];

    if(!model) return done({ error: { statusCode: 404 } });

    simulation.createInstance(instanceId, model, function (err, instance) {
      simulation.startInstance(instanceId, function (initialConfiguration) {
        //update data stores
        var map = definitionToInstances[chartName] = definitionToInstances[chartName] || [];
        map.push(instance.id);

        done(err, instanceId, initialConfiguration);
      });
    });
  }

  api.createInstance = function(req, res){
    api.createNamedInstance(req, res);
  };

  api.createNamedInstance = function(req, res){
    createInstance(req.params.StateChartName, req.params.InstanceId, function (err, instanceId, initialConfiguration) {
      if(err) return res.status(err.statusCode || 500).send(err.message);

      res.setHeader('Location', instanceId);
      res.setHeader('X-Configuration',JSON.stringify(initialConfiguration));

      res.sendStatus(201);
    });
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

    simulation.deleteStatechart(function (err) {
      if(err) return res.status(500).send(err);

      async.eachSeries(definitionToInstances[chartName], function (instanceId, done) {
        deleteInstance (chartName, instanceId, done);
      }, function () {
        var success = delete definitions[chartName];
        delete definitionToInstances[chartName];  

        if(success){
          res.sendStatus(200);
        }else{
          res.sendStatus(404);
        }
      });
    });
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

  api.getInstance = function(req, res){
    var chartName = req.params.StateChartName,
      instanceId = chartName + '/' + req.params.InstanceId;
        
      simulation.getInstanceSnapshot(instanceId, function (err, snapshot) {
        if(err) return res.status(err.statusCode || 500).send(err.message);

        res.status(200).send(snapshot);
      });
  };

  function sendEvent (instanceId, event, done) {
    if(!events[instanceId]) events[instanceId] = [];

    simulation.sendEvent(instanceId, event, function (err, conf) {
      if(err) return done(err);

      simulation.getInstanceSnapshot(instanceId, function (err, snapshot) {
        if(err) return done(err);
        
        events[instanceId].push({
          timestamp: new Date(),
          event: event,
          resultSnapshot: snapshot
        });

        done(err, conf);
      });
    });
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

    sendEvent(instanceId, event, function (err, config) {
      if(err) return res.status(err.statusCode || 500).send(err.message);
      
      res.setHeader('X-Configuration',JSON.stringify(config));
      res.sendStatus(200);
    });
  };

  function deleteInstance (chartName, instanceId, done) {
    simulation.deleteInstance(instanceId, function (err) {
      if(err) return done(err);

      var arr = definitionToInstances[chartName];
      arr.splice(arr.indexOf(instanceId), 1);

      done();
    });
  }

  api.deleteInstance = function(req, res){
    var chartName = req.params.StateChartName,
      instanceId = chartName + '/' + req.params.InstanceId;

    deleteInstance(chartName, instanceId, function (err) {
      if(err) return res.status(err.statusCode || 500).send(err.message);

      res.sendStatus(200);
    });
  };

  api.getInstanceChanges = function(req, res){
    var chartName = req.params.StateChartName,
      instanceId = chartName + '/' + req.params.InstanceId;

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

    simulation.registerListener(instanceId, listener, function () {
      sse.initStream(req, res, function(){
        simulation.unregisterListener(instanceId, listener);
      });
    });
  };

  api.instanceViz = function (req, res) {
    // var chartName = req.params.StateChartName,
    //   instanceId = chartName + '/' + req.params.InstanceId;

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

    var events = events[instanceId];

    if(!events) return res.sendStatus(404);

    res.status(200).send(events);
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
