const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
const pty = require("node-pty");
const crypto = require('crypto');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

const tokens = new Set();

app.get("/login", (req, res) => {
  const { user, pass } = req.query;
  let expectedUsername = 'a21659155516ac22dfc7a1afa749060ab8afa638a88513ab345b4fbb6ca49d56';
  let expectedPassword = '8af19114f54fb09d82efaec66e5266017bad83add3c894929e1531171f4271de';  
  let hashedUsername = crypto.createHash('sha256').update(user).digest('hex');
  let hashedPassword = crypto.createHash('sha256').update(pass).digest('hex');

  if (hashedUsername === expectedUsername && hashedPassword === expectedPassword) {
    const token = Math.random().toString(36).substring(2);
    tokens.add(token);
    return res.send({ success: true, token });
  }
  res.send({ success: false });
});

wss.on("connection", (ws, req) => {
  const params = new URLSearchParams(req.url.replace("/?", ""));
  const token = params.get("token");

  if (!tokens.has(token)) {
    ws.close(1008, "Invalid token");
    return; 
  }

  const shell = pty.spawn("bash", [], {
    name: "xterm-color",
    cols: 150,
    rows: 60,
    cwd: __dirname,
    env: process.env
  });

  shell.on("data", (data) => ws.send(data));
  ws.on("message", (msg) => shell.write(msg));
  ws.on("close", () => shell.kill());
});

server.listen(3000, () => console.log("http://localhost:3000"));
