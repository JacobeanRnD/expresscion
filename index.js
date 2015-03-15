var express = require("express")
 , url = require("url")
 , cors = require("cors")
 , path = require('path')
 , smaasJSON = require('../../smaas.json')
 , app = express()
 , swagger = require("swagger-node-express")
 , db = false
//TODO: parameterize this so that it can be specified on the CLI
//TODO: break out submodules so that they are independent node_modules
//TODO: connectors API too
 , provider = require('./providers/stateful/simple');   

smaasJSON.host = process.env.SMAAS_HOST_URL || 'localhost:8002';

var corsOptions = {
  credentials: true,
  origin: function(origin,callback) {
    if(origin===undefined) {
      callback(null,false);
    } else {
      callback(null,true);
    }
  }
};

//buffer the body
app.use(function(req, res, next) {
  req.body = '';
  req.on('data', function(data) {
    return req.body += data;
  });
  return req.on('end', next);
});

app.use(express.urlencoded());
app.use(cors(corsOptions));

var subpath = express();

app.use("/api/v1", subpath);

swagger.setAppHandler(subpath);

swagger.configureSwaggerPaths("", "api-docs", "")

var models = require("./swagger-generated/app/models.js");

var DefaultApi = require("./swagger-generated/app/apis/DefaultApi.js");

//iterate through keys of DefaultApi and replace actions
Object.keys(DefaultApi).forEach(function(key){
  DefaultApi[key].action = provider[key];
});

swagger.addModels(models)
  .addPOST(DefaultApi.createStatechartDefinition)
  .addGET(DefaultApi.getStatechartDefinitions)
  .addGET(DefaultApi.getStatechartDefinition)
  .addPUT(DefaultApi.createOrUpdateStatechartDefinition)
  .addPOST(DefaultApi.createInstance)
  .addDELETE(DefaultApi.deleteStatechartDefinition)
  .addGET(DefaultApi.getInstances)
  .addGET(DefaultApi.getStatechartDefinitionChanges)
  .addGET(DefaultApi.getInstance)
  .addPUT(DefaultApi.createNamedInstance)
  .addPOST(DefaultApi.sendEvent)
  .addDELETE(DefaultApi.deleteInstance)
  .addGET(DefaultApi.getInstanceChanges)
  ;

// configures the app
swagger.configure("http://localhost:8002/api/v1", "0.1");

app.get('/smaas.json', function (req, res) {
  res.json(smaasJSON);
});

//  start the server
app.listen(8002);

