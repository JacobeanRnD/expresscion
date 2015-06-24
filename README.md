[![Tests](https://travis-ci.org/JacobeanRnD/expresscion.svg?branch=master)](https://travis-ci.org/JacobeanRnD/expresscion)

Expresscion is an open, cloud-friendly SCXML orchestration server.

Expresscion (formerly SCXMLD) provides Node.js express middleware which
implements the [State Machines as a Service (SMaaS)](https://github.com/JacobeanRnD/SMaaS-swagger-spec) 
REST protocol. 


## Installation

Install PostgreSQL and Redis and set POSTGRES_URL and REDIS_URL in your environment. 

You can clone this [project boilerplate](https://github.com/JacobeanRnD/expresscion-hello-world-node-project) and run `npm install`; or follow the instructions. 

Init a new Node.js project with `npm init`.

Create a new `index.scxml` file in the project root.

Install expresscion as package dependency: `npm install --save expresscion`

Add to package.json:

```
  "scripts": {
    "start": "node node_modules/expresscion/index.js index.scxml"
  },
```

Then run `npm start`, and visit [http://localhost:8002/](http://localhost:8002/) in your web browser.

Optionally, install command-line tools: https://github.com/JacobeanRnD/smaas-cli

## Deploy to the cloud

Expresscion is designed to work well with existing devops tools. Here is how to deploy to heroku:

```
heroku create my-app
heroku git:remote -a my-app
heroku addons:create heroku-postgresql
heroku addons:create heroku-redis
heroku config:set POSTGRES_URL=`heroku config:get DATABASE_URL`
heroku config:set HOST=my-app.herokuapp.com
git push heroku master
```

## Links

* [State Machines as a Service: An SCXML Microservices Platform for the Internet of Things](http://scxmlworkshop.de/eics2015/submissions/State%20Machines%20as%20a%20Service.pdf)
