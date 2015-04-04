'use strict';

var scxml = require('scxml');

var instances = {};

module.exports.createStatechart = function (scxmlString, done) {
  scxml.documentStringToModel(null, scxmlString, done);
};

module.exports.createInstance = function (id, model, done) {
  var instance = new scxml.scion.Statechart(model);
  instance.id = id;
  
  instances[instance.id] = instance;

  done(null, instance);
};

module.exports.startInstance = function (id, done) {
  var instance = instances[id];

  done(null, instance.start());
};

module.exports.getInstanceSnapshot = function (id, done) {
  var instance = instances[id];

  done(null, instance.getSnapshot());
};

module.exports.deleteStatechart = function (name, done) {
  // Simple server doesn't need to delete anything on simulation side
  done(null);
};

module.exports.deleteInstance = function (id, done) {
  // Simple server doesn't need to delete anything on simulation side
  done(null);
};

