'use strict';

var scxml = require('scxml'),
  fs = require('fs'),
	validate = require('./validate-scxml').validateCreateScxmlRequest;

module.exports = function(scxmlPath, done) {
  fs.readFile(scxmlPath, 'utf8', function (err, scxmlString) {
    if(err) return done(err);

    validate(scxmlString, function(scxmlSchemaErrors) {   
      if(scxmlSchemaErrors) return done(scxmlSchemaErrors);

      scxml.pathToModel(scxmlPath, done);    
    });
  });
};