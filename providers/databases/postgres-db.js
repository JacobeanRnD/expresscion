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
  opts.connectionString = opts.connectionString || process.env.POSTGRES_URL || 'postgres://localhost:5432/smaas';

  // I think execution should wait for db to initialize
  pg.connect(opts.connectionString, function (connectError, client, done) {
    if(connectError) return console.log('Postgres connection error', connectError);

    var schemas = [
      'CREATE TABLE IF NOT EXISTS ' +
      ' statecharts(name varchar primary key,' +
      ' scxml varchar,' +
      ' created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW())',

      'CREATE TABLE IF NOT EXISTS' +
      ' instances(id varchar primary key,' +
      ' statechartName name REFERENCES statecharts(name) ON DELETE CASCADE,' +
      ' created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW())',
      
      'CREATE TABLE IF NOT EXISTS' + 
      ' events(id uuid primary key default uuid_generate_v4(),' +
      ' instanceId varchar REFERENCES instances(id) ON DELETE CASCADE,' +
      ' event JSON,' +
      ' snapshot JSON,' +
      ' created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW())',
      
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
    
  db.saveStatechart = function (name, scxmlString, done) {
    query({
      text: 'SELECT * FROM statecharts WHERE name = $1',
      values: [name]
    }, function (error, result) {
      if(error) return done(error);

      if(result.rowCount === 0) {
        query({
          text: 'INSERT INTO statecharts (name, scxml) VALUES($1, $2)',
          values: [name, scxmlString]
        }, function (error) {
          if(error) return done(error);

          done();
        });
      } else {
        query({
          text: 'UPDATE statecharts SET scxml = $1',
          values: [scxmlString]
        }, function (error) {
          if(error) return done(error);

          done();
        });
      }
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

  db.getStatechartList = function (done) {
    query({
      text: 'SELECT * FROM statecharts',
      values: []
    }, function (error, result) {
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
      console.log(result.rows);

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
      values: [instanceId, details.event, details.resultSnapshot, details.timestamp]
    }, function (error) {
      if(error) return done(error);

      done();
    });
  };

  db.set = function (key, value, done) {
    query({
      text: 'INSERT INTO metainfo (key, data) VALUES($1, $2)',
      values: [key, value]
    }, function (error) {
      if(error) return done(error);

      done();
    });
  };

  db.get = function (key, done) {
    query({
      text: 'SELECT * FROM metainfo WHERE key = $1',
      values: [key]
    }, function (error, result) {
      if(error) return done(error);

      done(null, result.data);
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