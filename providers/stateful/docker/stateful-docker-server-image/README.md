How to run:

```
vagrant up
vagrant plugin install vagrant-vbguest
vagrant reload
cd /vagrant/node_modules/scion-sandbox-worker
'docker build -t jbeard4/scion-sandbox-worker .’
docker run -p 3001:3000 -d jbeard4/scion-sandbox-worker /usr/bin/node /src/bin/www

#on OS X
curl -i $(boot2docker ip):3001    
```

```
jbeard4@Jacobs-MacBook-Pro-2:~/workspace/jacobean/deus-ex-state-machine-sandbox/node_modules/simulcurl                ation-server$ curl -i $(boot2docker ip):3001
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 25
ETag: W/"19-8a03c74b"
Date: Sat, 07 Feb 2015 05:57:14 GMT
Connection: keep-alive

{"scion-sandbox":"1.0.0"}
```
