'use strict';

var scxml = require('scxml'),
  uuid = require('uuid');

var models = {};
var instances = {};

module.exports = function () {
  var server = {};

  server.createStatechart = function (scName, scxmlString, done) {
    scxml.documentStringToModel(null, scxmlString, function (err, model) {
      var chartName = scName || model().name || uuid.v1();

      models[chartName] = model;

      done(err, chartName);
    });
  };

  server.createInstance = function (chartName, id, done) {
    var instance = new scxml.scion.Statechart(models[chartName]);
    instance.id = chartName + '/' + (id || uuid.v1());
    
    instances[instance.id] = instance;

    done(null, instance.id);
  };

  server.startInstance = function (id, done) {
    var instance = instances[id];

    var conf = instance.start();

    done(null, conf);
  };

  server.getInstanceSnapshot = function (id, done) {
    var instance = instances[id];

    done(null, instance.getSnapshot());
  };

  server.sendEvent = function (id, event, done) {
    var instance = instances[id];

    var conf = instance.gen(event);

    done(null, conf);
  };

  server.registerListener = function (id, listener, done) {
    var instance = instances[id];

    instance.registerListener(listener);

    done();
  };

  server.unregisterListener = function (id, listener, done) {
    var instance = instances[id];

    instance.unregisterListener(listener);

    if(done) done();
  };

  server.deleteStatechart = function (name, done) {
    // Simple server doesn't need to delete anything on simulation side
    done();
  };

  server.deleteInstance = function (id, done) {
    delete instances[id];

    done();
  };

  return server;
};