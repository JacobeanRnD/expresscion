var scxml = require('scxml');
var uuid = require('uuid');
var fs = require('fs');
var path = require('path');
var validate = require('../common/validate-scxml');
var sse = require('../common/sse');

var dockerode = require('dockerode');
var request = require('request');

var containers = [];

//TODO: set up dockerode

function createStatechartDefinition(req,res,scName){
  validate(req, function(errors, scxmlDoc){

    if(errors) return res.send(400,{name : 'error.create', data : errors});

    var scxmlString = req.body;
    scxml.documentStringToModel(null, scxmlString, function(err, model){
      var chartName = scName || model.name || uuid.v1());

      //TODO: create an image with the compiled module baked in
      docker.buildImage('archive.tar', {t: chartName}, function (err, response){
        //...

        broadcastDefinitionChange(scxmlString);

        res.setHeader('Location', chartName);
        res.send(201);

      });

    });
  });
}

function createInstance(req, res, instanceId){
  var chartName = req.param('StateChartName');
  instanceId = chartName  + '/' + (instanceId || uuid.v1());

  //TODO: create a container
  docker.createContainer({Image: chartName, name: instanceId}, function (err, container) {
    container.start(function (err, data) {

      //...

      res.setHeader('Location', instanceId);
      res.setHeader('X-Configuration',JSON.stringify(initialConfiguration));

      res.send(201);
    });
  });
}

module.exports.createStatechartDefinition = function(req, res){
  createStatechartDefinition(req,res);
};

module.exports.getStatechartDefinitions = function(req, res){
  docker.listImages(function(err, images){
    res.send(images);
  });
};

module.exports.getStatechartDefinition = function(req, res){
  var chartName = req.param('StateChartName');

  //TODO: read file out of docker image, or keep it in separate repo
};

module.exports.createOrUpdateStatechartDefinition = function(req, res){
  createStatechartDefinition(req,res,req.param('StateChartName'));
};

module.exports.createInstance = function(req, res){
  createInstance(req, res);
};

module.exports.deleteStatechartDefinition = function(req, res){
  var chartName = req.param('StateChartName');

  docker.removeImage(chartName, function(err){
    //TODO: remove containers?
    if(success){
      res.send(200);
    }else{
      res.send(404);
    }
  });
};

module.exports.getInstances = function(req, res){
  var chartName = req.param('StateChartName');
  
  docker.listContainers({filter : 'name=' + chartName + '/'},function(err, instances){
    //TODO: would be better to support filtering based on image name. This is OK for now
    if(instances){
      res.send(instances);
    }else{
      res.send(404);
    }
  });
};

module.exports.getStatechartDefinitionChanges = function(req, res){
  var chartName = req.param('StateChartName');

  var statechartDefinitionSubscriptions = 
    statechartDefinitionSubscriptions[chartName] = 
      statechartDefinitionSubscriptions[chartName] || [];
  statechartDefinitionSubscriptions.push(res);

  sse.initStream(req, res, function(){
    statechartDefinitionSubscriptions.splice(
      statechartDefinitionSubscriptions.indexOf(res), 1);
  });
};

module.exports.getInstance = function(req, res){
  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  docker.listContainers({filter : 'name=' + instanceId},function(err, instances){
    if(instances && instances.length){
      var instance = instances[0];
      //TODO: call into the instance to fetch the snapshot
      res.send(instance);
    }else{
      res.send(404);
    }
  });
};

module.exports.createNamedInstance = function(req, res){
  createInstance(req, res, req.param('InstanceId'));
};

module.exports.sendEvent = function(req, res){

  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  var event = JSON.parse(req.body);

  //get the instance
  docker.listContainers({filter : 'name=' + instanceId},function(err, instances){
    if(instances && instances.length){
      var instance = instances[0];
      instance.inspect(function(err, info){
        request.post({
          url : 'http://' + info.NetworkSettings.IPAddress + ':80/react',
          json : event 
        }, function(err, response, body){
          if(err){
            res.send(500);
          }else{
            res.setHeader('X-Configuration',JSON.stringify(nextConfiguration));
            res.send(200);
          }
        });
      });
    }else{
      res.send(404);
    }
  });
};

module.exports.deleteInstance = function(req, res){
  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  var container = docker.getContainer(instanceId);
  container.stop(function(err){
    //TODO: how do we know if container not found? e.g. 404 versus 500
    container.remove(function(err){
      res.send(200);
    });
  });
};

module.exports.getInstanceChanges = function(req, res){
  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  //TODO: simply proxy to the container's IP address and _changes API
};

function broadcastDefinitionChange(chartName, scxmlString){
  var statechartDefinitionSubscriptions = statechartDefinitionSubscriptions[chartName];
  if(statechartDefinitionSubscriptions) {
    statechartDefinitionSubscriptions.forEach(function(response) {
      response.write('event: onChange\n');
      response.write('data: ' + scxmlString + '\n\n');
    });
  }
}

