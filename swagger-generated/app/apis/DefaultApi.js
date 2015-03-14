var swagger = require("swagger-node-express");
var url = require("url");
var errors = swagger.errors;
var params = swagger.params;

/* add model includes */

function writeResponse (response, data) {
  response.header('Access-Control-Allow-Origin', "*");
  response.header("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT");
  response.header("Access-Control-Allow-Headers", "Content-Type");
  response.header("Content-Type", "application/json; charset=utf-8");
  response.send(JSON.stringify(data));
}

exports.models = models = require("../models.js");

exports.createStatechartDefinition = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/",
    "notes" : "",
    "summary" : "Create a state machine definition.",
    "method": "POST",
    "params" : [].concat([]).concat([]).concat([
      params.body("body", "", "SCXML file", true)
    ]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "createStatechartDefinition"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing createStatechartDefinition as a POST method?"});    
  }
};
exports.getStatechartDefinitions = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/_all_statechart_definitions",
    "notes" : "",
    "summary" : "Get list of all statecharts",
    "method": "GET",
    "params" : [].concat([]).concat([]).concat([]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "getStatechartDefinitions"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing getStatechartDefinitions as a GET method?"});    
  }
};
exports.getStatechartDefinition = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/{StateChartName}",
    "notes" : "",
    "summary" : "Get information on the Statechart definition, including SCXML, SCJSON, etc.",
    "method": "GET",
    "params" : [].concat([
      params.path("StateChartName", "Name of the previously created statechart")
    ]).concat([]).concat([]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "getStatechartDefinition"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing getStatechartDefinition as a GET method?"});    
  }
};
exports.createOrUpdateStatechartDefinition = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/{StateChartName}",
    "notes" : "",
    "summary" : "Updates an existing state machine definition",
    "method": "PUT",
    "params" : [].concat([
      params.path("StateChartName", "Name of the previously created statechart")
    ]).concat([]).concat([
      params.body("body", "", "SCXML file", true)
    ]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "createOrUpdateStatechartDefinition"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing createOrUpdateStatechartDefinition as a PUT method?"});    
  }
};
exports.createInstance = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/{StateChartName}",
    "notes" : "",
    "summary" : "Create an instance with random id",
    "method": "POST",
    "params" : [].concat([
      params.path("StateChartName", "Name of the previously created statechart")
    ]).concat([]).concat([]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "createInstance"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing createInstance as a POST method?"});    
  }
};
exports.deleteStatechartDefinition = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/{StateChartName}",
    "notes" : "",
    "summary" : "Delete an existing Statechart",
    "method": "DELETE",
    "params" : [].concat([
      params.path("StateChartName", "Name of the previously created statechart")
    ]).concat([]).concat([]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "deleteStatechartDefinition"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing deleteStatechartDefinition as a DELETE method?"});    
  }
};
exports.getInstances = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/{StateChartName}/_all_instances",
    "notes" : "",
    "summary" : "Get list of all statechart instances",
    "method": "GET",
    "params" : [].concat([
      params.path("StateChartName", "Name of the previously created statechart")
    ]).concat([]).concat([]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "getInstances"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing getInstances as a GET method?"});    
  }
};
exports.getStatechartDefinitionChanges = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/{StateChartName}/_changes",
    "notes" : "",
    "summary" : "Subscribe to statechart Changes API",
    "method": "GET",
    "params" : [].concat([
      params.path("StateChartName", "Name of the previously created statechart")
    ]).concat([]).concat([]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "getStatechartDefinitionChanges"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing getStatechartDefinitionChanges as a GET method?"});    
  }
};
exports.getInstance = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/{StateChartName}/{InstanceId}",
    "notes" : "",
    "summary" : "Get information on all statechart instance, including current state",
    "method": "GET",
    "params" : [].concat([
      params.path("StateChartName", "Name of the previously created statechart"),
    
      params.path("InstanceId", "Id or name of the instance")
    ]).concat([]).concat([]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "getInstance"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing getInstance as a GET method?"});    
  }
};
exports.createNamedInstance = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/{StateChartName}/{InstanceId}",
    "notes" : "",
    "summary" : "Create an instance with given id",
    "method": "PUT",
    "params" : [].concat([
      params.path("StateChartName", "Name of the previously created statechart"),
    
      params.path("InstanceId", "Id or name of the instance")
    ]).concat([]).concat([]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "createNamedInstance"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing createNamedInstance as a PUT method?"});    
  }
};
exports.sendEvent = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/{StateChartName}/{InstanceId}",
    "notes" : "",
    "summary" : "Send an event to the Statechart instance",
    "method": "POST",
    "params" : [].concat([
      params.path("StateChartName", "Name of the previously created statechart"),
    
      params.path("InstanceId", "Id or name of the instance")
    ]).concat([]).concat([
      params.body("body", "", "An event object", true)
    ]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "sendEvent"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing sendEvent as a POST method?"});    
  }
};
exports.deleteInstance = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/{StateChartName}/{InstanceId}",
    "notes" : "",
    "summary" : "Delete an existing Statechart instance",
    "method": "DELETE",
    "params" : [].concat([
      params.path("StateChartName", "Name of the previously created statechart"),
    
      params.path("InstanceId", "Id or name of the instance")
    ]).concat([]).concat([]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "deleteInstance"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing deleteInstance as a DELETE method?"});    
  }
};
exports.getInstanceChanges = {
  'spec': {
    "description" : "Operations about pets",
    "path" : "/{StateChartName}/{InstanceId}/_changes",
    "notes" : "",
    "summary" : "Subscribe to instance Changes API",
    "method": "GET",
    "params" : [].concat([
      params.path("StateChartName", "Name of the previously created statechart"),
    
      params.path("InstanceId", "Id or name of the instance")
    ]).concat([]).concat([]),
    
    
    "type" : "Message",
    
    "responseMessages" : [errors.invalid('id'), errors.notFound('Message')],
    "nickname" : "getInstanceChanges"
  },
  'action': function (req,res) {
    
    writeResponse(res, {message: "how about implementing getInstanceChanges as a GET method?"});    
  }
};
