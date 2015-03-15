Stateless server architecture is suitable for large-scale deployments. Scales
better, because we do not need to keep a separate server to store the state of
each instance. State is moved out into a data store. Events are processed
using an asynchronous queue. 

Architecture:

```
API <--> Persistence + Queue + Routing <-- (Authorization) --> Stateless Simulation Service
```

Data storage requirements are simple for SMaaS, so we can use an abstraction
layer to support multiple data stores, which may be better suited for different
use cases.

Likewise, we can use an abstraction for the asynchronous queue to support different
queuing implementations.

To be determined: whether to hold open the response of `<send>` until
the event has been processed.
