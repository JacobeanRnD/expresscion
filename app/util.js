'use strict';

var util = {};

util.IsOk = function (error, response) {
  if (error) {
    if(!response.headersSent) {
      response.status(error.statusCode || 500).send({
        name: 'error.on.action',
        data: {
          message: error.message || error
        }
      });
    }

    return false;
  }

  return true;
};

util.dbIsOkAndNotEmpty = function (error, response, dbResult) {
  var isOk = util.IsOk(response, error);

  if (!isOk) return false;

  if (dbResult.rowCount === 0) {
    //If db has no records
    response.status(404).send({
      name: 'error.finding.record',
      data: {
        message: 'Could not find the record'
      }
    });

    return false;
  } else {
    return true;
  }
};

util.getShortInstanceId = function (instanceId) {
  return instanceId.split('/')[1];
};

util.getInstanceId = function (req) {
  return req.params.StateChartName + '/' + req.params.InstanceId;
};

module.exports = util;
