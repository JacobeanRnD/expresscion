SMaaS server implementation relying on persistent state machine instances. 

Each instance lives in memory, usually in a separate sub-process to prevent
server lock-up on infinite loop. 

Architecture:

```
API <--> Router <-- (Authorization) --> Instance Server
```

That's it. The API simply serves to bring/up down the instance servers, and
route requests to the appropriate server.

We can use technology like docker, docker-swarm, and Mesos to distribute
instance servers across a cluster.

An advantage of the stateful technology is that it is possible to store native
(non-JSON serializable) objects in the datamodel, and reference them across
big-steps, as they will be stored in memory, and not serialized to JSON and
stored in the database as would be the case with the stateless server. This 
allows deeper platform integration with, e.g. nodejs or Rhino.
