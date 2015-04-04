var os = require('os');
var urlModule = require('url');
var Docker = require('dockerode');
var fs = require('fs');

if(os.type() === 'Darwin'){
  var url = urlModule.parse(process.env.DOCKER_HOST);
  var docker = new Docker({
        host : url.hostname, 
        port : url.port, 
        protocol: 'https',
        ca: fs.readFileSync(process.env.DOCKER_CERT_PATH + '/ca.pem'),
        cert: fs.readFileSync(process.env.DOCKER_CERT_PATH + '/cert.pem'),
        key: fs.readFileSync(process.env.DOCKER_CERT_PATH + '/key.pem')
      });
}else if(os.type() === 'Linux'){
  docker = new Docker({ socketPath : '/var/run/docker.sock' });
}else{
  throw new Error('OS not supported');
}

module.exports = docker;
