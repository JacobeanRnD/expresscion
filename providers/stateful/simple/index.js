'use strict';

var scxml = require('scxml');

var instances = {};

// Consider initializing the module to be async. 

module.exports.createStatechart = function (scxmlString, done) {
  scxml.documentStringToModel(null, scxmlString, done);
};

module.exports.createInstance = function (id, model, done) {
  var instance = new scxml.scion.Statechart(model);
  instance.id = id;
  
  instances[instance.id] = instance;

  done(null);
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

