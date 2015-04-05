/*
 * SandboxWorker:
 * Node server, implements a stateless protocol for SCXML simluation.
 * [instanceId, scxml, snapshot or null, event or null] -> snapshot 
 *
 * Also, emits realtime events on the _changes channel, of the form: [instanceId, event]
 * 
 * Caches parsed SCXML JavaScript modules for performance.
 *
 * For now, we send along the entire scxml file as a string. 
 * Later, we should use a URL. If it changed, then we re-parse.
 */

var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var scxml = require('scxml');
var url = require('url');
var sse = require('./sse');
//TODO: maybe also get the SCXML?
var model = require('./compiled-scxml.js');

var instance;

var app = express();

app.use(bodyParser.json());

app.post('/start',function(req,res){
  var snapshot = req.body.snapshot;

  instance = new scxml.scion.Statechart(model, { snapshot: snapshot });

  if(!snapshot){
    instance.start(); 
  }

  res.json(instance.getConfiguration());
});

app.get('/',function(req,res){
  return res.json(instance.getSnapshot());
});

app.post('/',function(req,res){
  var event = req.body;
  instance.gen(event);
  //TODO: let the statechart control the response
  return res.json(instance.getConfiguration());
});

app.get('/_changes',function(req,res){

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
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.json({
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({
        message: err.message,
        error: {}
    });
});


module.exports = app;
