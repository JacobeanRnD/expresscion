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

function createStatechartDefinition(req,res,scName){
  validate(req, function(errors, scxmlDoc){

    if(errors) return res.send(400,{name : 'error.create', data : errors});

    var scxmlString = req.body;
    scxml.documentStringToModel(null, scxmlString, function(err, model){
      var chartName = scName || model().name || uuid.v1();

      definitions[chartName] = scxmlString;
      compiledDefinitions[chartName] = model;
      definitionToInstances[chartName] = [];

      broadcastDefinitionChange(chartName, scxmlString);

      res.setHeader('Location', chartName);
      res.send(201);
    });
  });
}

function createInstance(req, res, instanceId){
  //1. fetch statechart definition
  //2. instantiate statechart
  //3. start statechart
  //4. get the initial configuration and set the x-configuration header
  
  var chartName = req.param('StateChartName');
  var model = compiledDefinitions[chartName];
  var sc = new scxml.scion.Statechart(model);
  var initialConfiguration = sc.start();

  instanceId = chartName  + '/' + (instanceId || uuid.v1());

  //update data stores
  var map = 
    definitionToInstances[chartName] = 
      definitionToInstances[chartName] || [];
  map.push(instanceId);
  instances[instanceId] = sc;

  res.setHeader('Location', instanceId);
  res.setHeader('X-Configuration',JSON.stringify(initialConfiguration));

  res.send(201);
}

module.exports.createStatechartDefinition = function(req, res){
  createStatechartDefinition(req,res);
};

module.exports.getStatechartDefinitions = function(req, res){
  res.json(Object.keys(definitions));
};

module.exports.getStatechartDefinition = function(req, res){
  //1. fetch statechart definition
  var chartName = req.param('StateChartName');

  var model = definitions[chartName];
  if(model){
      res.send(model);
  }else {
      res.send(404);
  }
};

module.exports.createOrUpdateStatechartDefinition = function(req, res){
  createStatechartDefinition(req,res,req.param('StateChartName'));
};

module.exports.createInstance = function(req, res){
  createInstance(req, res);
};

module.exports.deleteStatechartDefinition = function(req, res){
  var chartName = req.param('StateChartName');

  var success = delete definitions[chartName];
  definitionToInstances[chartName].forEach(function(instanceId){
    //TODO: stop running instances
    delete instances[instanceId];
  });
  delete definitionToInstances[chartName];
  
  if(success){
    res.send(200);
  }else{
    res.send(404);
  }
};

module.exports.getInstances = function(req, res){
  var chartName = req.param('StateChartName');
  
  var instances = definitionToInstances[chartName];

  if(instances){
    res.json(instances);
  }else{
    res.send(404);
  }
};

module.exports.getStatechartDefinitionChanges = function(req, res){
  var chartName = req.param('StateChartName');

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
  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  var sc = instances[instanceId];
  if(sc){
      res.send(sc.getSnapshot());
  }else {
      res.send(404);
  }
};

module.exports.createNamedInstance = function(req, res){
  createInstance(req, res, req.param('InstanceId'));
};

module.exports.sendEvent = function(req, res){
  console.time('event');

  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  var sc = instances[instanceId];

  var event = JSON.parse(req.body);
  
  console.log('event started', event);

  var nextConfiguration = sc.gen(event); 
  res.setHeader('X-Configuration',JSON.stringify(nextConfiguration));

  console.timeEnd('event');
  console.log('event ended', event);
  res.send(200);
};

module.exports.deleteInstance = function(req, res){
  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  var success = delete instances[instanceId];
  var arr = definitionToInstances[chartName];
  arr.splice(arr.indexOf(instanceId),1);

  if(success){
    res.send(200);
  }else{
    res.send(404);
  }
};

module.exports.getInstanceChanges = function(req, res){
  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  var instance = instances[instanceId];

  if(!instance) return res.send(404);

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

module.exports.viz = function (req, res) {
  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  var instance = instances[instanceId];

  if(!instance) return res.send(404);

  res.render('viz.html');
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
