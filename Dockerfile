FROM    ubuntu:13.10

RUN apt-get update
RUN apt-get install -y nodejs
RUN ln -s /usr/bin/nodejs /usr/bin/node
RUN apt-get install -y npm
RUN apt-get install -y git
RUN apt-get install -y libxml2

# Bundle app source
COPY . /src
# Install app dependencies
RUN cd /src; npm install

EXPOSE  8002

CMD ["/usr/bin/node", "/src/index.js"]
