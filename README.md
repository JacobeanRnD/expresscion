## SCXMLD

SCXMLD is an open SCXML orchestration server. SCXMLD provides a server
implementation of the State Machines as a Service (SMaaS) REST API.

### Architecture

SCXMLD is extensible through "database providers" and "simulation providers".
In this way, SCXMLD supports persistence of state machine snapshots to various
data storage back-ends; and supports execution of user-specified JavaScript in
various state machine interpreter contexts. By default, SCXMLD includes an
in-memory database provider, and a simple SCION simulation sandbox. 

SCXMLD can be installed and run locally, or deployed to the cloud.

This is an alpha release. Subsequent releases will document the node module
API.

### Installation

```
git clone git@github.com:JacobeanRnD/SCXMLD.git
cd SCXMLD
npm install -g .
```
