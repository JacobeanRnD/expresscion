var express = require("express")
 , url = require("url")
 , cors = require("cors")
 , app = express()
 , swagger = require("swagger-node-express")
 , db = false


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

app.use(express.json());
app.use(express.urlencoded());
app.use(cors(corsOptions));

var subpath = express();

app.use("/api/v1", subpath);

swagger.setAppHandler(subpath);

swagger.configureSwaggerPaths("", "api-docs", "")

var models = require("./app/models.js");

var DefaultApi = require("./app/apis/DefaultApi.js");

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

//  start the server
app.listen(8002);
