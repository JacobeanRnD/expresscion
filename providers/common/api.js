'use strict';

var uuid = require('uuid');
var async = require('async');
var validate = require('./validate-scxml').validateCreateScxmlRequest;
var sse = require('./sse');

var statechartDefinitionSubscriptions = {};

module.exports = function (simulation, db) {
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

        db.saveStatechart(chartName, scxmlString, model, handler, function () {
          res.setHeader('Location', chartName);
          res.sendStatus(201);

          broadcastDefinitionChange(chartName);  
        });
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
    db.getStatechart(chartName, function (err, scxml, model) {
      if(!model) return done({ error: { statusCode: 404 } });

      simulation.createInstance(instanceId, model, function () {
        // TODO: maybe save here?

        simulation.startInstance(instanceId, function (err, initialConfiguration) {
          db.saveInstance(chartName, instanceId, function () {
            done(err, instanceId, initialConfiguration);
          });
        });
      });
    });
  }

  api.createInstance = function(req, res){
    api.createNamedInstance(req, res);
  };

  api.createNamedInstance = function(req, res){
    var chartName = req.params.StateChartName,
      instanceId = chartName  + '/' + (req.params.InstanceId || uuid.v1());

    createInstance(chartName, instanceId, function (err, instanceId, initialConfiguration) {
      if(err) return res.status(err.statusCode || 500).send(err.message);

      res.setHeader('Location', instanceId);
      res.setHeader('X-Configuration',JSON.stringify(initialConfiguration));

      res.sendStatus(201);
    });
  };

  api.getStatechartDefinitions = function(req, res){
    db.getStatechartList(function (list) {
      res.send(list);
    });
  };

  api.getStatechartDefinition = function(req, res){
    var chartName = req.params.StateChartName;

    db.getStatechart(chartName, function (err, scxml) {
      if(!scxml) return res.sendStatus(404);

      res.status(200).send(scxml);
    });
  };

  api.deleteStatechartDefinition = function(req, res){
    var chartName = req.params.StateChartName;

    // Delete the statechart object in simulation
    simulation.deleteStatechart(chartName, function (err) {
      if(err) return res.status(500).send(err);

      // Get list of instances
      db.getInstances(chartName, function (instances) {
        async.eachSeries(instances, function (instanceId, done) {
          // Delete each instance object in simulation
          deleteInstance (chartName, instanceId, function () {
            // Delete each instance from db
            db.deleteInstance(chartName, instanceId, done);
          });
        }, function () {
          // Delete statechart from db
          db.deleteStatechart(chartName, function (err) {
            if(err) return res.status(err.statusCode || 500).send(err.message);

            res.sendStatus(200);
          });
        });
      });
    });
  };

  api.getInstances = function(req, res) {
    var chartName = req.params.StateChartName;

    db.getStatechart(chartName, function (err, scxml, model, instances) {
      res.send(instances);
    });
  };

  api.getStatechartDefinitionChanges = function(req, res){
    var chartName = req.params.StateChartName;

    db.getStatechart(chartName, function (err, scxml) {
      if(!scxml) return res.sendStatus(404);

      var statechartDefinitionSubscription = 
        statechartDefinitionSubscriptions[chartName] = 
          statechartDefinitionSubscriptions[chartName] || [];
      statechartDefinitionSubscription.push(res);

      sse.initStream(req, res, function(){
        statechartDefinitionSubscription.splice(
          statechartDefinitionSubscription.indexOf(res), 1);
      });
    });
  };

  api.getInstance = function(req, res){
    var instanceId = getInstanceId(req);
        
      simulation.getInstanceSnapshot(instanceId, function (err, snapshot) {
        if(err) return res.status(err.statusCode || 500).send(err.message);

        res.status(200).send(snapshot);
      });
  };

  function sendEvent (instanceId, event, done) {
    simulation.sendEvent(instanceId, event, function (err, conf) {
      if(err) return done(err);

      simulation.getInstanceSnapshot(instanceId, function (err, snapshot) {
        if(err) return done(err);
        
        db.saveEvent(instanceId, {
          timestamp: new Date(),
          event: event,
          resultSnapshot: snapshot
        }, function () {
          done(null, conf);
        });
      });
    });
  }

  api.sendEvent = function(req, res){
    var instanceId = getInstanceId(req),
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

      db.deleteInstance(chartName, instanceId, done);
    });
  }

  api.deleteInstance = function(req, res){
    var chartName = req.params.StateChartName,
      instanceId = getInstanceId(req);

    deleteInstance(chartName, instanceId, function (err) {
      if(err) return res.status(err.statusCode || 500).send(err.message);

      res.sendStatus(200);
    });
  };

  api.getInstanceChanges = function(req, res){
    var instanceId = getInstanceId(req);

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
    var chartName = req.params.StateChartName,
      instanceId = getInstanceId(req);

    db.getInstance(chartName, instanceId, function (err, exists) {
      if(!exists) return res.sendStatus(404);

      res.render('viz.html', {
        type: 'instance'
      });
    });
  };

  api.statechartViz = function (req, res) {
    var chartName = req.params.StateChartName;

    db.getStatechart(chartName, function (err, scxml) {
      if(!scxml) return res.sendStatus(404);

      res.render('viz.html', {
        type: 'statechart'
      });
    });
  };

  api.getEventLog = function (req, res) {
    var instanceId = getInstanceId(req);

    var events = events[instanceId];

    if(!events) return res.sendStatus(404);

    res.status(200).send(events);
  };

  function broadcastDefinitionChange(chartName){
    var statechartDefinitionSubscription = statechartDefinitionSubscriptions[chartName];
    if(statechartDefinitionSubscription) {
      statechartDefinitionSubscription.forEach(function(response) {
        response.write('event: onChange\n');
        response.write('data:\n\n');
      });
    }
  }

  function getInstanceId (req) {
    return req.params.StateChartName + '/' + req.params.InstanceId;
  }

  return api;
};
