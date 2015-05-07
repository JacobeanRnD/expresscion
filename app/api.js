'use strict';

var async = require('async');
var tar = require('tar-stream');
var uuid = require('uuid');
var validate = require('./validate-scxml').validateCreateScxmlRequest;
var sse = require('./sse');
var util = require('./util');
var knox = require('knox');
var debug = require('debug')('scxmld');

var cephClient = knox.createClient({
  port: process.env.CEPH_PORT,
  bucket: process.env.CEPH_BUCKET,
  endpoint: process.env.CEPH_HOST,
  key : process.env.CEPH_KEY,
  secret : process.env.CEPH_SECRET,
  style: 'path',
  secure: false
});


var statechartDefinitionSubscriptions = {};

module.exports = function (simulation, db) {
  var api = {};

  function createStatechartDefinitionWithTarball (req, res, scName) {
    // What is happening here:
    // 1 - request body has tar stream which goes into tar parser
    // 2 - "on entry" section is storing each file on memory for inspection, validation etc.
    // 3 - files goes into the simulation server
    var mainFileStr = '', scxmlName, tempCephFolder = uuid.v1(), isFailed = false, fileList = [];

    var extract = tar.extract();

    extract.on('entry', function(header, stream, callback) {
      if(header.name === 'index.scxml') {
        //Read index.scxml file
        stream.on('data', function (c) {
          mainFileStr += c.toString();
        });

        stream.on('end', function () {
          validate(mainFileStr, function(errors, name) {
            if(errors) {
              console.log('errors on scxml schema');
              // TODO: Cancel parsing of tar stream

              isFailed = true;
              return res.status(400).send({ name: 'error.xml.schema', data: errors });
            }

            scxmlName = name;   //capture SCXML name
          });
        });
      }

      fileList.push(header.name);
      var cephRequest = cephClient.put(tempCephFolder + '/' + header.name, {
        'Content-Length': header.size,
        'Content-Type': 'text/plain'
      });

      stream.pipe(cephRequest);
      cephRequest.on('response', function () {
        callback();
      });

      cephRequest.on('error', function (err) {
        isFailed = true;
        
        callback();

        if (!util.IsOk(err, res)) return;
      });
    });

    extract.on('finish', function() {
      // all entries done - lets finalize it
      if(!isFailed) processStatechart(tempCephFolder);
    });

    //Start flowing the stream
    req.pipe(extract);

    function processStatechart () {
      // TODO: Validate all .scxml files with async.eachSeries
      // TODO: Abort stream parsing if there is validation error
      // TODO: Pick index.js or first .scxml file as main
      // TODO: Create each scxml file as a statechart so invoke can work
      // TODO: Save statecharts to DB
      // TODO: Broadcast each scxml change

      if(!mainFileStr) return res.status(400).send({ name: 'error.missing.file', data: { message: 'index.scxml is missing.' } });

      var chartName = scName || scxmlName || uuid.v1();

      cephClient.deleteFile(chartName, function(err){
        if (!util.IsOk(err, res)) return;

        async.each(fileList, function (fileName, done) {
          //Copy each file
          cephClient.copyFile(tempCephFolder + '/' + fileName, chartName + '/' + fileName, done);
        }, function(err){
          if (!util.IsOk(err, res)) return;

          simulation.createStatechartWithTar(chartName, function (err) {
            if (!util.IsOk(err, res)) return;

            db.saveStatechart(req.user, chartName, function () {
              res.setHeader('Location', chartName);
              res.status(201).send({ name: 'success.create.definition', data: { chartName: chartName }});

              broadcastDefinitionChange(chartName);
            });
          });
        });
      });
    }
  }

  function createStatechartDefinitionWithJson (req, res, scName) {
    var scxmlString = req.body;

    validate(scxmlString, function(errors, scxmlName) {
      if(errors) return res.status(400).send({ name: 'error.xml.schema', data: errors });

      var chartName = scName || scxmlName || uuid.v1();

      cephClient.deleteFile(chartName, function(err){
        if (!util.IsOk(err, res)) return;

        cephClient.putBuffer(scxmlString, chartName + '/index.scxml', function(err){
          if (!util.IsOk(err, res)) return;

          simulation.createStatechart(chartName, scxmlString, function (err) {
            if (!util.IsOk(err, res)) return;

            db.saveStatechart(req.user, chartName, function (err) {
              if (!util.IsOk(err, res)) return;

              broadcastDefinitionChange(chartName);

              res.setHeader('Location', chartName);
              return res.status(201).send({ name: 'success.create.definition', data: { chartName: chartName }});
            });
          });
        });
      });        
    });
  }

  function createStatechartDefinition(req, res, scName) {
    if(req.is('application/x-tar')) {
      return createStatechartDefinitionWithTarball(req, res, scName);
    } else  {
      return createStatechartDefinitionWithJson(req, res, scName);
    }
  }

  api.createStatechartDefinition = function(req, res){
    createStatechartDefinition(req,res);
  };

  api.createOrUpdateStatechartDefinition = function(req, res){
    createStatechartDefinition(req, res, req.params.StateChartName);
  };

  function createInstance(chartName, instanceId, done){

    cephClient.getFile(chartName + '/index.scxml', function(err, cephResponse){
      
      var scxmlString = '';
      cephResponse.on('data',function(s){
        scxmlString += s;
      });
      cephResponse.on('end',function(){
        if(!scxmlString) return done({ error: { statusCode: 404 } });

        simulation.createInstance(chartName, instanceId, function (err, instanceId) {
          debug('simulation.createInstance response',chartName, instanceId, null);
          db.saveInstance(chartName, instanceId, null, function () {
            done(err, instanceId);
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

    db.getStatechart(chartName, function (err, scxml) {
      if (!util.IsOk(err, res)) return;

      db.getInstance(chartName, chartName + '/' + req.params.InstanceId, function (err, exists) {
        if(exists) return res.status(409).send({ name: 'error.creating.instance', data: { message: 'InstanceId is already associated with an instance' }});

        createInstance(chartName, req.params.InstanceId, function (err, instanceId) {
          if (!util.IsOk(err, res)) return;
          if(err && err.statusCode === 404) return res.status(404).send({ name: 'error.getting.statechart', data: { message: 'Statechart definition not found' }});

          res.setHeader('Location', instanceId);

          res.status(201).send({ name: 'success.create.instance', data: { id: util.getShortInstanceId(instanceId) }});
        });
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

    cephClient.getFile(chartName + '/index.scxml', function(err, cephResponse){
      if (!util.IsOk(err, res)) return;
      
      var scxmlString = '';
      cephResponse.on('data',function(s){
        scxmlString += s;
      });
      cephResponse.on('end',function(){
        if(!scxmlString) return res.status(404).send({ name: 'error.getting.statechart', data: { message: 'Statechart definition not found' }});

        res.type('application/scxml+xml').send(scxmlString);    //return XML instead of JSON
      });
    });
  };

  api.deleteStatechartDefinition = function(req, res){
    //TODO: delete definition in ceph
    var chartName = req.params.StateChartName;

    // Get list of instances
    db.getInstances(chartName, function (err, instances) {
      if (!util.IsOk(err, res)) return;
      
      async.eachSeries(instances || [], function (instanceId, done) {
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
    var chartName = req.params.StateChartName;
    var instanceId = util.getInstanceId(req);

    db.getInstance(chartName, instanceId, function (err, snapshot) {
      if (!util.IsOk(err, res)) return;

      res.send({ name: 'success.get.instance', data: { instance: { snapshot: snapshot }}});
    });
  };

  function sendEvent (chartName, instanceId, event, sendUrl, done) {
    simulation.sendEvent(instanceId, event, sendUrl, function (err, conf, wait) {
      if(err) return done(err);

      db.saveInstance(chartName, instanceId, conf, function () {
        if(err) return done(err);

        db.saveEvent(instanceId, {
          timestamp: new Date(),
          event: event,
          snapshot: conf
        }, function (err) {
          done(err, conf[0]);
        });
      });
    }, respond);
  }

  var eventQueue = {};
  var isProcessing = false;

  api.sendEvent = function(req, res) {
    var chartName = req.params.StateChartName;
    var instanceId = util.getInstanceId(req),
      event;

    try {
       event = JSON.parse(req.body);
    } catch(e) {
      return res.status(400).send({ name: 'error.parsing.json', data: { message: 'Malformed event body.' }});
    }

    // Queue logic:
    //
    // push event to queue
    // start processing
    //
    // If process is busy, do nothing
    // completed process will dequeue the next event

    var queue = eventQueue[instanceId] = eventQueue[instanceId] || [];

    event.uuid = uuid.v1(); //tag him with a uuid

    queue.push([event, res]);
    processEventQueue();

    function processEventQueue () {
      if(isProcessing || queue.length === 0) return;

      isProcessing = true;

      var tuple = queue.shift();

      var event = tuple[0],
          res = tuple[1];

      db.getInstance(chartName, instanceId, function (err) {
        if(err) {
          isProcessing = false;
          return res.status(err.statusCode || 500).send(err);
        }

        var sendUrl = req.protocol + '://' + req.get('Host') + req.url;

        pendingResponses[event.uuid] = res;   //save the response

        sendEvent(chartName, instanceId, event, sendUrl, function (err, nextConfiguration) {
          console.log('sendEvent response',err, nextConfiguration);
          isProcessing = false;

          if (!util.IsOk(err, res)) return;

          processEventQueue();
        });
      });
    }
  };

  var pendingResponses = {};

  function respond(eventUuid, snapshot, customData){
    var res = pendingResponses[eventUuid];
    if(!res) return;      //this can happen if, for example, 
                          //the server dies before the response has been released
    if(snapshot){
      res.setHeader('X-Configuration',JSON.stringify(snapshot));
      res.send({ name: 'success.event.sent', data: { snapshot: snapshot }});
    }else{
      res.send(customData);
    }
    delete pendingResponses[eventUuid];
  }

  function deleteInstance (chartName, instanceId, done) {
    simulation.unregisterAllListeners(instanceId, function () {
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
        simulation.unregisterListener(instanceId, res);
      });
    });
  };

  api.instanceViz = function (req, res) {
    var chartName = req.params.StateChartName,
      instanceId = util.getInstanceId(req);

    db.getInstance(chartName, instanceId, function (err, exists) {
      if(typeof exists === 'undefined') return res.sendStatus(404);

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
