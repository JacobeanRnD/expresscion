var scxml = require('scxml');
var uuid = require('uuid');
var fs = require('fs');
var path = require('path');
var validate = require('../../common/validate-scxml').validateCreateScxmlRequest;
var sse = require('../../common/sse');

var definitions = {};
var compiledDefinitions = {};
var definitionToInstances = {};
var instances = {};
var statechartDefinitionSubscriptions = {};
var events = {};

function createStatechartDefinition(req,res,scName){
  validate(req, function(errors, scxmlDoc){

    if(errors) return res.status(400).send({ name : 'error.create', data : errors });

    var scxmlString = req.body;
    scxml.documentStringToModel(null, scxmlString, function(err, model){
      var chartName = scName || model().name || uuid.v1();

      definitions[chartName] = scxmlString;
      compiledDefinitions[chartName] = model;
      definitionToInstances[chartName] = [];

      broadcastDefinitionChange(chartName, scxmlString);

      res.setHeader('Location', chartName);
      res.sendStatus(201);
    });
  });
}

function createInstance(req, res, instanceId){
  //1. fetch statechart definition
  //2. instantiate statechart
  //3. start statechart
  //4. get the initial configuration and set the x-configuration header
  
  var chartName = req.params.StateChartName;
  instanceId = chartName  + '/' + (instanceId || uuid.v1());
  var model = compiledDefinitions[chartName];
  var instance = new scxml.scion.Statechart(model);
  events[instanceId] = [];

  var listener = {
    onEntry : function(stateId){
      events[instanceId].push({ name: 'onEntry', data: stateId });
    },
    onExit : function(stateId){
      events[instanceId].push({ name: 'onExit', data: stateId });
    },
    onTransition : function(sourceStateId,targetStatesIds){
      //TODO: spec this out
    }
  };

  instance.registerListener(listener);

  var initialConfiguration = instance.start();

  //update data stores
  var map = 
    definitionToInstances[chartName] = 
      definitionToInstances[chartName] || [];
  map.push(instanceId);
  instances[instanceId] = instance;

  res.setHeader('Location', instanceId);
  res.setHeader('X-Configuration',JSON.stringify(initialConfiguration));

  res.sendStatus(201);
}

module.exports.createStatechartDefinition = function(req, res){
  createStatechartDefinition(req,res);
};

module.exports.getStatechartDefinitions = function(req, res){
  res.json(Object.keys(definitions));
};

module.exports.getStatechartDefinition = function(req, res){
  //1. fetch statechart definition
  var chartName = req.params.StateChartName;

  var model = definitions[chartName];
  if(model){
      res.status(200).send(model);
  }else {
      res.sendStatus(404);
  }
};

module.exports.createOrUpdateStatechartDefinition = function(req, res){
  createStatechartDefinition(req, res, req.params.StateChartName);
};

module.exports.createInstance = function(req, res){
  createInstance(req, res);
};

module.exports.deleteStatechartDefinition = function(req, res){
  var chartName = req.params.StateChartName;

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

module.exports.getInstances = function(req, res){
  var chartName = req.params.StateChartName;
  
  var instances = definitionToInstances[chartName];

  if(instances){
    res.json(instances);
  }else{
    res.sendStatus(404);
  }
};

module.exports.getStatechartDefinitionChanges = function(req, res){
  var chartName = req.params.StateChartName;

  var statechartDefinitionSubscription = 
    statechartDefinitionSubscriptions[chartName] = 
      statechartDefinitionSubscriptions[chartName] || [];
  statechartDefinitionSubscription.push(res);

  sse.initStream(req, res, function(){
    statechartDefinitionSubscription.splice(
      statechartDefinitionSubscription.indexOf(res), 1);
  });
};

module.exports.getInstance = function(req, res){
  var chartName = req.params.StateChartName,
    instanceId = chartName + '/' + req.params.InstanceId;

  var sc = instances[instanceId];
  if(sc){
      res.status(200).send(sc.getSnapshot());
  }else {
      res.sendStatus(404);
  }
};

module.exports.createNamedInstance = function(req, res){
  createInstance(req, res, req.params.InstanceId);
};

module.exports.sendEvent = function(req, res){
  var chartName = req.params.StateChartName,
    instanceId = chartName + '/' + req.params.InstanceId;

  var instance = instances[instanceId];

  var event = JSON.parse(req.body);

  var nextConfiguration = instance.gen(event); 
  res.setHeader('X-Configuration',JSON.stringify(nextConfiguration));

  res.sendStatus(200);
};

module.exports.deleteInstance = function(req, res){
  var chartName = req.params.StateChartName,
    instanceId = chartName + '/' + req.params.InstanceId;

  var success = delete instances[instanceId];
  var arr = definitionToInstances[chartName];
  arr.splice(arr.indexOf(instanceId),1);

  if(success){
    res.sendStatus(200);
  }else{
    res.sendStatus(404);
  }
};

module.exports.getInstanceChanges = function(req, res){
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
    },
    onTransition : function(sourceStateId,targetStatesIds){
      //TODO: spec this out
    }
  };

  instance.registerListener(listener);

  sse.initStream(req, res, function(){
    instance.unregisterListener(listener);
  });
};

module.exports.instanceViz = function (req, res) {
  var chartName = req.params.StateChartName,
    instanceId = chartName + '/' + req.params.InstanceId;

  var instance = instances[instanceId];

  if(!instance) return res.sendStatus(404);

  res.render('viz.html', {
    type: 'instance'
  });
}

module.exports.statechartViz = function (req, res) {
  var chartName = req.params.StateChartName;

  var definition = definitions[chartName];

  if(!definitions) return res.sendStatus(404);

  res.render('viz.html', {
    type: 'statechart'
  });
}

module.exports.getEventLog = function (req, res) {
  var chartName = req.params.StateChartName,
    instanceId = chartName + '/' + req.params.InstanceId;

  var instance = instances[instanceId];

  if(!instance) return res.sendStatus(404);

  res.status(200).send(events[instanceId]);
}

function broadcastDefinitionChange(chartName, scxmlString){
  var statechartDefinitionSubscription = statechartDefinitionSubscriptions[chartName];
  if(statechartDefinitionSubscription) {
    statechartDefinitionSubscription.forEach(function(response) {
      response.write('event: onChange\n');
      response.write('data: ' + scxmlString + '\n\n');
    });
  }
}
