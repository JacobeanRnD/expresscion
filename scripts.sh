docker run -p 8002:8002 -i jbeard4/scxmld
docker build -t jbeard4/scxmld .
scxml --host http://192.168.59.103:8002 viz -b foo.scxml/496cbfb0-d67c-11e4-8ce7-498cc8a707f7
