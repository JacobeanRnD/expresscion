## SCXMLD

![Tests](https://magnum.travis-ci.com/JacobeanRnD/SCXMLD.svg?token=tW6nVvCmQPPuKMxQTSmg&branch=master)

SCXMLD is an open SCXML orchestration server. SCXMLD provides a server
implementation of the [State Machines as a Service (SMaaS)](https://github.com/JacobeanRnD/SMaaS-swagger-spec) REST API.

### Installation

```
npm install -g scxmld scxml-cli
```

See [SCXML-CLI](https://github.com/JacobeanRnD/SCXML-CLI) for information on command-line syntax. 

### Architecture

SCXMLD is extensible through "database providers" and "simulation providers".
In this way, SCXMLD supports persistence of state machine snapshots to various
data storage back-ends; and supports execution of user-specified JavaScript in
various state machine interpreter contexts. By default, SCXMLD includes an
in-memory database provider, and a simple SCION simulation sandbox. 

SCXMLD can be installed and run locally, or deployed to the cloud.

This is an alpha release. Subsequent releases will document the node module
API. 

