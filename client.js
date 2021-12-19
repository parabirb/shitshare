/*
    client for shitshare
    public domain, written by parabirb
*/

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Hyperswarm = require("hyperswarm");
const CubeHash = require("node-cubehash");
const util = require("node-cubehash/util");
const readlineSync = require("readline-sync");
const cubehash = new CubeHash(16, 16, 32, 32, 256);
const hashtableTopic = Buffer.from(cubehash.hash(util.decodeUTF8("shitshare hashtable topic")));
const sharingTopic = Buffer.from(cubehash.hash(util.decodeUTF8("shitshare sharing topic")));

async function main() {
    // create files if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, "files"))) {
        fs.mkdirSync(path.join(__dirname, "files"));
    }
    // check whether user wants to upload or download
    let upload = readlineSync.keyInSelect(["Download", "Upload"], "Which service?") === 1;
    // if upload
    if (upload) {
        // let user pick file
        let filename = readlineSync.question("What is the file name? ");
        // check if file exists
        if (!fs.existsSync(path.join(__dirname, "files", filename))) {
            console.error("File does not exist.");
            process.exit(1);
        }
        // create swarm
        const swarm = new Hyperswarm();
        const file = fs.readFileSync(path.join(__dirname, "files", filename)).toString("base64");
        let hexHash = crypto.createHash("sha256").update(Buffer.from(file, "base64")).digest("hex");
        swarm.on("connection", (socket) => {
            // write to the socket
            socket.write(JSON.stringify({
                type: "upload",
                content: file
            }));
            // on socket data
            socket.on("data", (data) => {
                try {
                    let message = JSON.parse(data);
                    if (message.type === "confirm") {
                        if (message.content === hexHash) {
                            console.log(`File has been uploaded: ${message.content}`);
                        }
                        else {
                            console.log(`Server claims to have uploaded file, but something seems wrong. Be careful. ${message.content}`);
                        }
                    }
                }
                catch (e) {
                    // do nothing
                }
            });
        });
        // connect to network
        const discovery = swarm.join(sharingTopic, {server: false, client: true});
    }
    // if download
    else {
        // let user pick file
        let filename = readlineSync.question("What is the file name? ");
        // create two swarms (one for record request, one for file retrieval)
        const swarm1 = new Hyperswarm();
        const swarm2 = new Hyperswarm();
        // on connection (swarm1)
        swarm1.on("connection", (socket) => {
            socket.write(JSON.stringify({
                type: "record",
                content: filename
            }));
            // on socket data
            socket.on("data", (data) => {
                try {
                    // get message
                    let message = JSON.parse(data);
                    if (message.type === "record") {
                        for (let i = 0; i < message.content.length; i++) {
                            swarm2.joinPeer(Buffer.from(message.content[i], "hex"));
                        }
                    }
                }
                catch (e) {
                    // do nothing
                }
            });
        });
        // on connection (swarm2)
        swarm2.on("connection", (socket) => {
            socket.write(JSON.stringify({
                type: "download",
                content: filename
            }));
            // on socket data
            socket.on("data", (data) => {
                try {
                    // get message
                    let message = JSON.parse(data);
                    if (message.type === "file") {
                        let buffer = Buffer.from(message.content, "base64");
                        if (crypto.createHash("sha256").update(buffer).digest("hex") === filename) {
                            console.log("File downloaded.");
                            fs.writeFileSync(path.join(__dirname, "files", filename), buffer);
                            process.exit(1);
                        }
                    }
                }
                catch (e) {
                    // do nothing
                }
            });
        });
        // connect to topic
        swarm1.join(hashtableTopic, {server: false, client: true});
    }
}

main();