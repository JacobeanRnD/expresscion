'use strict';

module.exports = function (opts) {
  // Consider initializing the module to be async. 
  opts = opts || {};

  var db = {},
    definitions = {},
    definitionToInstances = {},
    events = {},
    metaInformation = {};
    
  db.saveStatechart = function (name, scxmlString, handler, done) {
    definitions[name] = scxmlString;
    definitionToInstances[name] = [];

    done();
  };

  db.getStatechart = function (name, done) {
    done(null, definitions[name], definitionToInstances[name]);
  };

  db.deleteStatechart = function (chartName, done) {
    delete definitions[chartName];

    done();
  };

  db.getStatechartList = function (done) {
    done(Object.keys(definitions));
  };

  db.saveInstance = function (chartName, instanceId, done) {
    events[instanceId] = [];

    var map = definitionToInstances[chartName] = definitionToInstances[chartName] || [];
    map.push(instanceId);

    done();
  };

  db.getInstance = function (chartName, instanceId, done) {
    var exists = definitionToInstances[chartName].indexOf(instanceId) !== -1;

    done(exists);
  };

  db.getInstances = function (chartName, done) {
    done(definitionToInstances[chartName]);
  };

  db.deleteInstance = function (chartName, instanceId, done) {
    var arr = definitionToInstances[chartName];
    arr.splice(arr.indexOf(instanceId), 1);

    done();
  };

  db.saveEvent = function (instanceId, event, done) {
    events[instanceId].push(event);

    done();
  };

  db.set = function (key, value, done) {
    metaInformation[key] = value;

    done();
  };

  db.get = function (key, done) {
    done(null, metaInformation[key]);
  };

  db.del = function (key, done) {
    var success = delete metaInformation[key];
    
    done(null, success);
  };

  return db;
};