var libxmljs = require('libxmljs');
var path = require('path');
var fs = require('fs');

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

module.exports.validate = function(scxmlDoc){
  return scxmlDoc.validate(scxmlSchema);
}


module.exports.validateCreateScxmlRequest = function(req, cb){
  if(req.headers['content-type'] === 'application/xml') {
    var scxmlDoc;

    try {
      scxmlDoc = libxmljs.parseXml(req.body);
    } catch(error) {
      return cb(['Document is not valid xml! Line: ' + error.line + ', Column: ' + error.column, error.message]);
    }

    //Validate against scxml specification
    if (!scxmlDoc.validate(scxmlSchema)) {
      var errors = scxmlDoc.validationErrors.map(function (error) {
        return ['Document is not valid! Line: ' + error.line + ', Column: ' + error.column, error.message];
      });

      return cb(errors);
    }

    cb(null, scxmlDoc);
  }else{
    return cb('Content-Type must be one appliction/xml');
  }
};
