'use strict';

var async = require('async');
var tar = require('tar');
var validate = require('./validate-scxml').validateCreateScxmlRequest;
var sse = require('./sse');
var util = require('./util');

var statechartDefinitionSubscriptions = {};

module.exports = function (simulation, db) {
  var api = {};

  function tarballStuff (req, res, scName) {
    console.log('tarball');

    req.pipe(tar.Parse()).on('entry', function (entry) {
      var fileName = entry.path,
        fileContents = '';

      entry.on('data', function (c) {
        fileContents += c.toString();
      });
      entry.on('end', function () {
        console.log(fileName, fileContents);
      });
    });
  }

  function createStatechartDefinition(req, res, scName) {
    console.log(req.headers);
    if(req.is('application/x-tar')) {
      return tarballStuff(req, res, scName);
    }



    var scxmlString = req.body;

    validate(scxmlString, function(errors) {
      if(errors) return res.status(400).send({ name: 'error.xml.schema', data: errors });

      simulation.createStatechart(scName, scxmlString, function (err, chartName) {
        if (!util.IsOk(err, res)) return;

        db.saveStatechart(req.user, chartName, scxmlString, function (err) {
          if (!util.IsOk(err, res)) return;

          res.setHeader('Location', chartName);
          res.status(201).send({ name: 'success.create.definition', data: { chartName: chartName }});

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
    db.getStatechart(chartName, function (err, scxml) {
      if(!scxml) return done({ error: { statusCode: 404 } });

      simulation.createInstance(chartName, instanceId, function (err, instanceId) {
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
    var chartName = req.params.StateChartName;

    db.getInstance(chartName, chartName + '/' + req.params.InstanceId, function (err, exists) {
      if(exists) return res.status(409).send({ name: 'error.creating.instance', data: { message: 'InstanceId is already associated with an instance' }});

      createInstance(chartName, req.params.InstanceId, function (err, instanceId, initialConfiguration) {
        if (!util.IsOk(err, res)) return;
        if(err && err.statusCode === 404) return res.status(404).send({ name: 'error.getting.statechart', data: { message: 'Statechart definition not found' }});

        res.setHeader('Location', instanceId);
        res.setHeader('X-Configuration',JSON.stringify(initialConfiguration));

        res.status(201).send({ name: 'success.create.instance', data: { id: util.getShortInstanceId(instanceId) }});
      });
    });
  };

  api.getStatechartDefinitions = function(req, res){
    db.getStatechartList(req.user, function (err, list) {
      if (!util.IsOk(err, res)) return;

      res.send({ name: 'success.get.charts', data: { charts: list }});
    });
  };

  api.getStatechartDefinition = function(req, res){
    var chartName = req.params.StateChartName;

    db.getStatechart(chartName, function (err, scxml) {
      if (!util.IsOk(err, res)) return;
      if(!scxml) return res.status(404).send({ name: 'error.getting.statechart', data: { message: 'Statechart definition not found' }});

      res.send({ name: 'success.get.definition', data: { scxml: scxml }});
    });
  };

  api.deleteStatechartDefinition = function(req, res){
    var chartName = req.params.StateChartName;

    // Get list of instances
    db.getInstances(chartName, function (err, instances) {
      if (!util.IsOk(err, res)) return;
      
      async.eachSeries(instances, function (instanceId, done) {
        // Delete each instance object in simulation
        deleteInstance (chartName, instanceId, function () {
          // Delete each instance from db
          db.deleteInstance(chartName, instanceId, done);
        });
      }, function (err) {
        if (!util.IsOk(err, res)) return;
        // Delete the statechart object in simulation
        simulation.deleteStatechart(chartName, function (err) {
          if (!util.IsOk(err, res)) return;
          // Delete statechart from db
          db.deleteStatechart(chartName, function (err) {
            if (!util.IsOk(err, res)) return;

            res.send({ name: 'success.deleting.definition', data: { message: 'Definition deleted successfully.' }});
          });
        });
      });
    });
  };

  api.getInstances = function(req, res) {
    var chartName = req.params.StateChartName;

    db.getInstances(chartName, function (err, instances) {
      if (!util.IsOk(err, res)) return;

      instances = instances.map(function (id) {
        return { id: id.split('/')[1] };
      });

      res.send({ name: 'success.get.instances', data: { instances: instances }});
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
    var instanceId = util.getInstanceId(req);
        
    simulation.getInstanceSnapshot(instanceId, function (err, snapshot) {
      if (!util.IsOk(err, res)) return;
      if(!snapshot) return res.status(404).send({ name: 'error.getting.instance', data: { message: 'Instance not found' }});

      res.send({ name: 'success.get.instance', data: { instance: { snapshot: snapshot }}});
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
          snapshot: snapshot
        }, function (err) {
          done(err, conf);
        });
      });
    });
  }

  api.sendEvent = function(req, res){
    var instanceId = util.getInstanceId(req),
      event;

    try {
       event = JSON.parse(req.body);
    } catch(e) {
      return res.status(400).send({ name: 'error.parsing.json', data: { message: 'Malformed event body.' }});
    }

    sendEvent(instanceId, event, function (err, nextConfiguration) {
      if (!util.IsOk(err, res)) return;

      res.setHeader('X-Configuration',JSON.stringify(nextConfiguration));
      res.send({ name: 'success.event.sent', data: { snapshot: nextConfiguration }});
    });
  };

  function deleteInstance (chartName, instanceId, done) {
    simulation.unregisterListener(instanceId, function () {
      simulation.deleteInstance(instanceId, function (err) {
        if(err) return done(err);

        db.deleteInstance(chartName, instanceId, done);
      });
    });
  }

  api.deleteInstance = function(req, res){
    var chartName = req.params.StateChartName,
      instanceId = util.getInstanceId(req);

    deleteInstance(chartName, instanceId, function (err) {
      if (!util.IsOk(err, res)) return;

      res.send({ name: 'success.deleting.instance', data: { message: 'Instance deleted successfully.' }});
    });
  };

  api.getInstanceChanges = function(req, res){
    var instanceId = util.getInstanceId(req);

    simulation.registerListener(instanceId, res, function () {
      sse.initStream(req, res, function(){
        simulation.unregisterListener(instanceId);
      });
    });
  };

  api.instanceViz = function (req, res) {
    var chartName = req.params.StateChartName,
      instanceId = util.getInstanceId(req);

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
    var instanceId = util.getInstanceId(req);

    db.getEvents(instanceId, function (err, events) {
      if (!util.IsOk(err, res)) return;

      res.send({ name: 'success.getting.logs', data: { events: events }});
    });
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

  return api;
};
