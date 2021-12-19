const fs = require("fs");
const path = require("path");
const readlineSync = require("readline-sync");
const serverCode = fs.readFileSync(path.join(__dirname, "server.js")).toString();
const clientCode = fs.readFileSync(path.join(__dirname, "client.js")).toString();
const configureCode = fs.readFileSync(path.join(__dirname, "configure.js")).toString();

let index = readlineSync.keyInSelect(["Client", "Server", "Configure"], "Which service?");

if (index === 0) eval(clientCode);
else if (index === 1) eval(serverCode);
else if (index === 2) eval(configureCode);