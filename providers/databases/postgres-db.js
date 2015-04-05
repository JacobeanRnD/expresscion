'use strict';

var pg = require('pg'),
  async = require('async');

module.exports = function (opts, initialized) {
  var db = {};

  if(typeof(opts) === 'function') {
    initialized = opts;
    opts = {};
  }

  opts = opts || {};
  opts.connectionString = opts.connectionString || process.env.POSTGRES_URL || 'postgres://postgres:test@localhost:5432/scxmld';

  // I think execution should wait for db to initialize
  pg.connect(opts.connectionString, function (connectError, client, done) {
    if(connectError){ 
      console.log('Postgres connection error', connectError);
      return initialized(connectError);
    }

    var schemas = [
      'CREATE TABLE IF NOT EXISTS ' +
      ' statecharts(name varchar primary key,' +
      ' userid varchar default null,' +
      ' scxml varchar,' +
      ' created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW())',

      'CREATE TABLE IF NOT EXISTS' +
      ' instances(id varchar primary key,' +
      ' statechartName name REFERENCES statecharts(name) ON DELETE CASCADE,' +
      ' created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW())',
      
      'CREATE TABLE IF NOT EXISTS' + 
      ' events(created TIMESTAMP WITH TIME ZONE primary key DEFAULT NOW(),' +
      ' instanceId varchar REFERENCES instances(id) ON DELETE CASCADE,' +
      ' event JSON,' +
      ' snapshot JSON)',
      
      'CREATE TABLE IF NOT EXISTS' +
      ' metainfo(key varchar primary key,' +
      ' data JSON,' +
      ' created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW())'
    ];

    async.eachSeries(schemas, function (schema, next) {
      client.query(schema, next);
    }, function (err) {
      if(err) {
        console.log('Error initializing postgres.', err);
      }
      
      client.end();
      done();
      initialized(err);
    });
  });

  function query (config, queryDone) {
    pg.connect(opts.connectionString, function (connectError, client, done) {
      if(connectError) return queryDone(connectError);

      client.query(config, function (queryError, result) {
        //Give back the client to postgres client pool
        done();

        //Return the result
        if (queryDone) queryDone(queryError, result);
      });
    });
  }
    
  db.saveStatechart = function (user, name, scxmlString, done) {
    var userId = null,
      insertQuery = {
        text: 'INSERT INTO statecharts (name, scxml) VALUES($1, $2)',
        values: [name, scxmlString]
      }, 
      updateQuery = {
        text: 'UPDATE statecharts SET scxml = $2 WHERE name = $1',
        values: [name, scxmlString]
      };

    if(user && user.id) {
      userId = user.id;

      insertQuery = {
        text: 'INSERT INTO statecharts (name, scxml, userid) VALUES($1, $2, $3)',
        values: [name, scxmlString, userId]
      };

      updateQuery = {
        text: 'UPDATE statecharts SET scxml = $2 WHERE name = $1 AND userid = $3',
        values: [name, scxmlString, userId]
      };
    }

    query(updateQuery, function (error, result) {
      if(error) return done(error);
      if(result.rowCount > 0) return done();

      query(insertQuery, function (error) {
        if(error) return done(error);

        done();
      });
    });
  };

  db.getStatechart = function (name, done) {
    query({
      text: 'SELECT * FROM statecharts WHERE name = $1',
      values: [name]
    }, function (error, result) {
      if(error) return done(error);

      var statechart = result.rows[0];
      
      done(null, statechart.scxml);
    });
  };

  db.deleteStatechart = function (chartName, done) {
    query({
      text: 'DELETE FROM statecharts WHERE name = $1',
      values: [chartName]
    }, function (error) {
      if(error) return done(error);

      done();
    });
  };

  db.getStatechartList = function (user, done) {
    var userId = null,
      selectQuery = {
        text: 'SELECT * FROM statecharts',
        values: []
      };

    if(user && user.id) {
      userId = user.id;

      selectQuery = {
        text: 'SELECT * FROM statecharts WHERE userid = $1',
        values: [userId]
      };
    }

    query(selectQuery, function (error, result) {
      if(error) return done(error);
      
      var statecharts = result.rows.map(function (statechart) {
        return statechart.name;          
      });

      done(null, statecharts);
    });
  };

  db.saveInstance = function (chartName, instanceId, done) {
    query({
      text: 'INSERT INTO instances (id, statechartName) VALUES($1, $2)',
      values: [instanceId, chartName]
    }, function (error) {
      if(error) return done(error);

      done();
    });
  };

  db.getInstance = function (chartName, instanceId, done) {
    query({
      text: 'SELECT * FROM instances WHERE instanceId = $1',
      values: [instanceId]
    }, function (error, result) {
      if(error) return done(error);

      done(result.rowCount > 0);
    });
  };

  db.getInstances = function (chartName, done) {
    query({
      text: 'SELECT * FROM instances WHERE statechartName = $1',
      values: [chartName]
    }, function (error, result) {
      if(error) return done(error);

      var instances = result.rows.map(function (instance) {
        return instance.id;          
      });

      done(null, instances);
    });
  };

  db.deleteInstance = function (chartName, instanceId, done) {
    query({
      text: 'DELETE FROM instances WHERE instanceId = $1',
      values: [instanceId]
    }, function (error) {
      if(error) return done(error);

      done();
    });
  };

  db.saveEvent = function (instanceId, details, done) {
    query({
      text: 'INSERT INTO events (instanceId, event, snapshot, created) VALUES($1, $2, $3, $4)',
      values: [instanceId, JSON.stringify(details.event), JSON.stringify(details.resultSnapshot), details.timestamp]
    }, function (error) {
      if(error) return done(error);

      done();
    });
  };

  db.set = function (key, value, done) {

    var values = [key, value];
    query({
      text : 'UPDATE metainfo SET data=$2 where key=$1;',
      values : values
    }, function(err, result){
      if(err) return done(err);
      if(result.rowCount > 0) return done();

      query({
        text : 'INSERT INTO metainfo (key, data) VALUES($1, $2);',
        values : values
      }, function(err, result){
        if(err) return done(err);

        done();
      }); 
    }); 
  };

  db.get = function (key, done) {
    query({
      text: 'SELECT * FROM metainfo WHERE key = $1',
      values: [key]
    }, function (error, result) {
      if(error) return done(error);

      if(result.rows.length){
        done(null, result.rows[0].data);
      }else{
        done(new Error('Unable to find container info'));
      }

    });
  };

  db.del = function (key, done) {
    query({
      text: 'DELETE FROM metainfo WHERE key = $1',
      values: [key]
    }, function (error) {
      if(error) return done(error);

      done(null, true);
    });
  };

  return db;
};
