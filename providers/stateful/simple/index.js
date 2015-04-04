'use strict';

var scxml = require('scxml'),
  uuid = require('uuid');

var models = {};
var instances = {};

// Consider initializing the module to be async. 

module.exports.createStatechart = function (scName, scxmlString, done) {
  scxml.documentStringToModel(null, scxmlString, function (err, model) {
    var chartName = scName || model().name || uuid.v1();

    models[chartName] = model;

    done(err, chartName);
  });
};

module.exports.createInstance = function (chartName, id, done) {
  var instance = new scxml.scion.Statechart(models[chartName]);
  instance.id = chartName + '/' + (id || uuid.v1());
  
  instances[instance.id] = instance;

  done(null, instance.id);
};

module.exports.startInstance = function (id, done) {
  var instance = instances[id];

  var conf = instance.start();

  done(null, conf);
};

module.exports.getInstanceSnapshot = function (id, done) {
  var instance = instances[id];

  done(null, instance.getSnapshot());
};

module.exports.sendEvent = function (id, event, done) {
  var instance = instances[id];

  var conf = instance.gen(event);

  done(null, conf);
};

module.exports.registerListener = function (id, listener, done) {
  var instance = instances[id];

  instance.registerListener(listener);

  done();
};

module.exports.unregisterListener = function (id, listener, done) {
  var instance = instances[id];

  instance.unregisterListener(listener);

  if(done) done();
};

module.exports.deleteStatechart = function (name, done) {
  // Simple server doesn't need to delete anything on simulation side
  done();
};

module.exports.deleteInstance = function (id, done) {
  delete instances[id];

  done();
};

