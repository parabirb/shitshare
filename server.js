/*
    server for shitshare
    public domain, written by parabirb
*/

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config.json");
const Hyperswarm = require("hyperswarm");
const CubeHash = require("node-cubehash");
const util = require("node-cubehash/util");
const cubehash = new CubeHash(16, 16, 32, 32, 256);
const hashtableTopic = Buffer.from(cubehash.hash(util.decodeUTF8("shitshare hashtable topic")));
const sharingTopic = Buffer.from(cubehash.hash(util.decodeUTF8("shitshare sharing topic")));
let hashtable = require("./hashtable.json");
let sockets = [];

async function main() {
    // create files if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, "files"))) {
        fs.mkdirSync(path.join(__dirname, "files"));
    }

    // chance
    function chance() {
        // we want a 1 in config.chance chance of false
        return !(new Uint32Array((new Uint8Array(crypto.randomBytes(4).buffer)).buffer)[0] % config.chance === 0);
    }

    // sync hashtable
    function syncHashtable() {
        fs.writeFileSync("hashtable.json", JSON.stringify(hashtable));
    }

    // create swarm instance
    const swarm = new Hyperswarm({
        seed: Buffer.from(config.seed, "base64"),
        firewall: chance
    });

    // hashtable discovery
    const hashtableDiscovery = swarm.join(hashtableTopic, {server: true, client: true});
    // file sharing discovery
    const sharingDiscovery = swarm.join(sharingTopic, {server: true, client: false});

    // hex of our public key
    const hexKey = swarm.keyPair.publicKey.toString("hex");

    // on connection
    swarm.on("connection", (socket, peerInfo) => {
        // push our socket to the socket list
        sockets.push(socket);
        // broadcast our file list to the user
        let files = fs.readdirSync(path.join(__dirname, "files"));
        // send updates
        for (let i = 0; i < files.length; i++) {
            socket.write(JSON.stringify({type: "update", content: {"key": files[i], "value": hexKey}}));
        }
        // on data
        socket.on("data", (data) => {
            try {
                // parse the data
                let message = JSON.parse(data);
                // if it's a hashtable update
                if (message.type === "update") {
                    if (typeof message.content.key === "string" && typeof message.content.value === "string") {
                        // append it to the hashtable
                        if (hashtable[message.content.key] === undefined) {
                            hashtable[message.content.key] = [message.content.value];
                            syncHashtable();
                        } else if (hashtable[message.content.key].indexOf(message.content.value) === -1) {
                            hashtable[message.content.key].append(message.content.value);
                            syncHashtable();
                        }
                    }
                }
                // if a user is trying to upload
                else if (message.type === "upload") {
                    // create buffer from the file
                    let buffer = Buffer.from(message.content, "base64");
                    // throw error if content isn't base64
                    if (buffer.length === 0) throw new Error("File is not in base64.");
                    // hash the file
                    let hash = crypto.createHash("sha256").update(buffer).digest("hex");
                    // write it
                    fs.writeFileSync(path.join(__dirname, "files", hash), buffer);
                    // forward to each socket
                    sockets.forEach((socket) => socket.write(JSON.stringify({
                        type: "update",
                        content: {key: hash, value: hexKey}
                    })));
                    // add to our own hashtable
                    if (hashtable[hash] === undefined) {
                        hashtable[hash] = [hexKey];
                        syncHashtable();
                    } else if (hashtable[hash].indexOf(hexKey) === -1) {
                        hashtable[hash].append(hexKey);
                        syncHashtable();
                    }
                    // send confirmation to client
                    socket.write(JSON.stringify({
                        type: "confirm",
                        content: hash
                    }));
                }
                // if a user is trying to download
                else if (message.type === "download") {
                    // create buffer from content hash
                    let filenameBuffer = Buffer.from(message.content, "hex");
                    // throw error if hash isn't in hex
                    if (filenameBuffer.length === 0) throw new Error("File name is not in hex.");
                    // check if the file hash exists
                    if (fs.existsSync(path.join(__dirname, "files", message.content))) {
                        // convert the file to base64
                        let base64 = fs.readFileSync(path.join(__dirname, "files", message.content));
                        // send file to client
                        socket.write(JSON.stringify({type: "file", content: base64}));
                    }
                    // throw error
                    else {
                        throw new Error("File is not stored on this server.");
                    }
                }
                // if a user is requesting a record
                else if (message.type === "record") {
                    // if said record exists
                    if (hashtable[message.content] !== undefined) {
                        // send the record
                        socket.write(JSON.stringify({type: "record", content: hashtable[message.content]}));
                    }
                }
            } catch (e) {
                // error out
                socket.write(JSON.stringify({type: "error", message: e.toString()}));
                return;
            }
        });
        // on end
        socket.on("end", () => {
            // remove socket from list
            sockets.splice(sockets.indexOf(socket), 1);
        });
    });
}

try {
    main();
}
catch (e) {
    console.error(e);
}