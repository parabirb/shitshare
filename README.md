# shitshare
shitshare is a shitty decentralized file sharing/hosting network based on the hyperswarm networking stack.

## Usage
Git clone the repo, then run `npm i`. Run `npm start` to start the program. For the server, you must run configure first before starting it for the first time.

## How does it work?
### Client
#### Downloading
The client connects to the hash table topic and looks up the hash of the file they want on every server which the client connects to. When a record for the hash is acquired, the client tries connecting to every server on the record and requesting the file from it.
#### Uploading
The client connects to the file sharing topic and sends a request to upload the file to every server the client connects to.
### Server
The server connects to the hash table topic and the file sharing topic. The server receives updates to the table and silently updates the record when such an update is received. When a connection is made to the server, the server immediately sends its whole table. When a user attempts to download a file, the file is sent to the client. When a user uploads a file, the file is saved onto the server and an update to the table is broadcasted to each peer the server is connected to.