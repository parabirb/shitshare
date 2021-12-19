/*
    Configuration interface for shitshare.
    Public domain, written by parabirb.
*/
const fs = require("fs");
const crypto = require("crypto");
const readlineSync = require("readline-sync");
let config = {};

// inform them that configuring will overwrite the key
let consented = readlineSync.keyInYN(`Are you sure you want to configure?
If you already have an existing configuration, doing this will overwrite your key and ALL of your existing configuration.`);
// if they didn't consent
if (!consented) process.exit(0);

console.log("Generating new key...");
config.seed = crypto.randomBytes(32).toString("base64");

let chance = NaN;
while (isNaN(chance)) {
    chance = +readlineSync.question("What chance value would you like for file hosting? The chance of you hosting a file is 1 in said chance. New node hosts should pick 1 if they are willing to donate their storage. ");
}
config.chance = chance;

console.log("Writing config...");
fs.writeFileSync("config.json", JSON.stringify(config));
fs.writeFileSync("hashtable.json", "{}");