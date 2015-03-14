var MODEL_SUFFIX = '.sc';
debugger;
var db = new (require('./db')).Store();
var scxml = require('scxml');
var libxmljs = require('libxmljs');
var uuid = require('uuid');
var fs = require('fs');
var path = require('path');

var scxmlSchemaPath = path.resolve(__dirname + '/../../scxml.xsd');
var scxmlSchemaContent = fs.readFileSync(scxmlSchemaPath, {
    encoding: 'utf-8'
  });
var scxmlSchema = libxmljs.parseXml(scxmlSchemaContent);

//Workaround for libxmljs to find imported xsd schema files
scxmlSchema.find('//xsd:import', {
  xsd: 'http://www.w3.org/2001/XMLSchema'
})[0].attr({
  schemaLocation: __dirname + '/../../xml.xsd'
});

function createStatechartDefinition(req,res,scName){
    if(req.headers['content-type'] === 'application/xml') {
      var scxmlDoc;

      try {
        scxmlDoc = libxmljs.parseXml(req.body);
      } catch(error) {
        return res.send(400, ['Document is not valid! Line: ' + error.line + ', Column: ' + error.column, error.message]);
      }

      //Validate against scxml specification
      if (!scxmlDoc.validate(scxmlSchema)) {
        var errors = scxmlDoc.validationErrors.map(function (error) {
          return 'Document is not valid! Line: ' + error.line + ', Column: ' + error.column, error.message;
        });

        return res.send(400, errors);
      }

      scxml.documentStringToModel(null,req.body,function(err, model){
          var o = model(),
            chartName = scName || o.name;

          if(chartName){
              db.put(chartName, req.body);
              db.put(chartName + MODEL_SUFFIX, model.toString());

              var subscriptions = subscriptionMap[chartName];
              if(subscriptions && subscriptions.length) {
                subscriptions.forEach(function(response) {
                  response.write('event: onChange\n');
                  response.write('data: \n\n');
                });
              }

              res.setHeader('Location', chartName);
              res.send(201);
          }else{
              res.send(401, 'Missing name');
          }
      });
    }else if(req.headers['content-type'] === 'application/json'){
        //TODO: support scjson as well 
        return res.send(500,{message : 'SCJSON not yet supported'});
    }else{
        //TODO: can we use SCXML-specific mime types?
        return res.send(400,{message : 'Content-Type must be one of appliction/xml or application/json'});
    }
}

function createInstance(req, res, instanceId){
  //1. fetch statechart definition
  //2. instantiate statechart
  //3. start statechart
  //4. get the initial configuration and set the x-configuration header
  
  var chartName = req.param('StateChartName');
  var key = chartName + MODEL_SUFFIX;
  var modelStr = db.get(key);
  var model = eval('(function(){ return ' + modelStr + ';})()');
  var sc = new scxml.scion.Statechart(model);
  var initialConfiguration = sc.start();

  instanceId = chartName + '/' + (instanceId || uuid.v1());
  db.put(instanceId, sc.getSnapshot());

  res.setHeader('Location', instanceId);
  res.setHeader('X-Configuration',JSON.stringify(initialConfiguration));

  res.send(201);      // TODO - statechart <send> will set set the body
}

module.exports.createStatechartDefinition = function(req, res){
  createStatechartDefinition(req,res);
};

module.exports.getStatechartDefinitions = function(req, res){
  var statecharts = Object.keys(db.memory).filter(function (element) {
    //Remove instances && Remove models
    return element.indexOf('/') === -1 && element.slice(-3) !== '.sc';
  });

  res.send(statecharts);
};

module.exports.getStatechartDefinition = function(req, res){
  //1. fetch statechart definition
  var chartName = req.param('StateChartName');

  var model = db.get(chartName);
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

  var success = db.del(chartName);
  if(success){
    res.send(200);
  }else{
    res.send(404);
  }
};

module.exports.getInstances = function(req, res){
  var chartName = req.param('StateChartName');
  var instances = Object.keys(db.memory).filter(function (element) {
    //Remove statecharts && Remove models
    return element.indexOf(chartName + '/') !== -1 && element.slice(-3) !== '.sc';
  });

  res.send(instances);
};

module.exports.getStatechartDefinitionChanges = function(req, res){
  var chartName = req.param('StateChartName');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache'
  });

  res.write(':' + new Array(2049).join(' ') + '\n'); // 2kB padding for IE
  res.write('retry: 2000\n');

  var subscriptions = subscriptionMap[chartName] = subscriptionMap[chartName] || [];
  subscriptions.push(res);

  res.write('event: subscribed\n');
  res.write('data: \n\n');

  var handle = setInterval(function() {
    res.write('\n');
  }, 30 * 1000);

  //clean up
  req.on('close', function() {
    console.log('Request closed');
    subscriptions.splice(subscriptions.indexOf(res), 1);
    clearInterval(handle);
  });
};

module.exports.getInstance = function(req, res){
  //1. fetch statechart instance by id
  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  var model = db.get(instanceId);
  if(model){
      res.send(model);
  }else {
      res.send(404);
  }
};

module.exports.createNamedInstance = function(req, res){
  createInstance(req, res, req.param('InstanceId'));
};

module.exports.sendEvent = function(req, res){
  //1. fetch statechart definition
  //2. fetch the serialized statechart instance by id
  //3. start statechart
  //4. dispatch the event on the statechart
  //5. get the new configuration and set the x-configuration header
  //6. save him back to the database

  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  var statechartDefinitionKey = chartName + MODEL_SUFFIX;
  var modelStr = db.get(statechartDefinitionKey);
  var snapshot = db.get(instanceId);

  if(!snapshot){
    return res.send(404, 'Instance not found');
  }

  var model = eval('(function(){ return ' + modelStr + ';})()');

  var sc = new scxml.scion.Statechart(model,{snapshot : snapshot});

  var subscriptions = subscriptionMap[instanceId];
  //TODO: event ids
  if(subscriptions && subscriptions.length) {
    var listener = {
      onEntry : function(stateId){
        subscriptions.forEach(function(response){
          response.write('event: onEntry\n');
          response.write('data: ' + stateId + '\n\n');
        });
      },
      onExit : function(stateId){
        subscriptions.forEach(function(response) {
          response.write('event: onExit\n');
          response.write('data: ' + stateId + '\n\n');
        });
      },
      onTransition : function(sourceStateId,targetStatesIds){}
    };
    sc.registerListener(listener);
  }

  var event = JSON.parse(req.body);
  var nextConfiguration = sc.gen(event); 

  res.setHeader('X-Configuration',JSON.stringify(nextConfiguration));
  db.put(instanceId, sc.getSnapshot());

  res.send(200);      // TODO - statechart <send> will set set the body
};

module.exports.deleteInstance = function(req, res){
  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  var success = db.del(instanceId);
  if(success){
    res.send(200);
  }else{
    res.send(404);
  }
};

var subscriptionMap = {};
module.exports.getInstanceChanges = function(req, res){
  var chartName = req.param('StateChartName'),
    instanceId = chartName + '/' + req.param('InstanceId');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache'
  });

  res.write(':' + new Array(2049).join(' ') + '\n'); // 2kB padding for IE
  res.write('retry: 2000\n');

  var subscriptions = subscriptionMap[instanceId] = subscriptionMap[instanceId] || [];
  subscriptions.push(res);

  res.write('event: subscribed\n');
  res.write('data: \n\n');

  var handle = setInterval(function() {
    res.write('\n');
  }, 30 * 1000);

  //clean up
  req.on('close', function() {
    console.log('Request closed');
    subscriptions.splice(subscriptions.indexOf(res), 1);
    clearInterval(handle);
  });
};
