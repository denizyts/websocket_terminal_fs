const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
const pty = require("node-pty");
const crypto = require('crypto');
const fs = require("fs");
const archiver = require("archiver");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true }); 

// const ROOT_DIR = __dirname; 
const ROOT_DIR = "/";
const tokens = new Set();

app.use(express.static(path.join(__dirname, "public")));

app.get("/login", (req, res) => {
  const { user, pass } = req.query;
  const {pair} = require("./userPassword");

  const hashedUsername = crypto.createHash('sha256').update(user).digest('hex');
  const hashedPassword = crypto.createHash('sha256').update(pass).digest('hex');

  if (hashedUsername === pair.expectedUsername && hashedPassword === pair.expectedPassword) {
    const token = Math.random().toString(36).substring(2);
    tokens.add(token);
    return res.send({ success: true, token });
  }
  res.send({ success: false });
});

server.on("upgrade", (request, socket, head) => {
  const urlParams = new URLSearchParams(request.url.replace("/?", ""));
  const token = urlParams.get("token");
  const type = urlParams.get("type"); 

  if (!tokens.has(token)) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, ws => {
    if (type === "terminal") handleTerminalWS(ws);
    else if (type === "filemanager") handleFileManagerWS(ws);
  });
});

function handleTerminalWS(ws) {
  const shell = pty.spawn("bash", [], {
    name: "xterm-color",
    cols: 150,
    rows: 60,
    cwd: ROOT_DIR,
    env: process.env
  });

  shell.on("data", (data) => ws.send(data));
  ws.on("message", (msg) => shell.write(msg));
  ws.on("close", () => shell.kill());
}

function handleFileManagerWS(ws) {
  ws.on("message", msg => {
    const data = JSON.parse(msg);
    if (data.type === "list") sendList(ws, data.path || ".");
    if (data.type === "download") handleDownload(ws, data.path);
    if (data.type === "upload") handleUpload(ws, data.path, data.filename, data.content);
    if (data.type === "delete") handleDelete(ws, data.path);
    if (data.type === "deleteMany") handleDeleteMany(ws, data.paths);
  });
}

function sendList(ws, dirPath) {
  fs.readdir(path.join(ROOT_DIR, dirPath), { withFileTypes: true }, (err, files) => {
    if (err) return;
    ws.send(JSON.stringify({
      type: "list",
      path: dirPath,
      files: files.map(f => ({ name: f.name, isDir: f.isDirectory() }))
    }));
  });
}

function handleDownload(ws, filePath) {
  const fullPath = path.join(ROOT_DIR, filePath);
  fs.stat(fullPath, (err, stats) => {
    if (err) return;
    if (stats.isFile()) {
      fs.readFile(fullPath, (err, content) => {
        if (err) return;
        ws.send(JSON.stringify({ type: "download", filename: path.basename(fullPath), content: content.toString("base64") }));
      });
    } else if (stats.isDirectory()) {
      const zipPath = fullPath + ".zip";
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", () => {
        fs.readFile(zipPath, (err, content) => {
          if (err) return;
          ws.send(JSON.stringify({ type: "download", filename: path.basename(fullPath) + ".zip", content: content.toString("base64") }));
          fs.unlink(zipPath, () => {});
        });
      });
      archive.pipe(output);
      archive.directory(fullPath, false);
      archive.finalize();
    }
  });
}

function handleUpload(ws, dirPath, filename, base64) {
  const buffer = Buffer.from(base64, "base64");
  const fullDir = path.join(ROOT_DIR, dirPath);
  const fullFile = path.join(fullDir, filename);
  fs.mkdir(fullDir, { recursive: true }, (err) => {
    if (err) return ws.send(JSON.stringify({ type: "error", message: err.message }));
    fs.writeFile(fullFile, buffer, (err) => {
      if (err) return ws.send(JSON.stringify({ type: "error", message: err.message }));
      ws.send(JSON.stringify({ type: "upload", status: "ok" }));
      sendList(ws, dirPath);
    });
  });
}

function handleDelete(ws, filePath) {
  const fullPath = path.join(ROOT_DIR, filePath);
  fs.rm(fullPath, { recursive: true, force: true }, err => {
    if (err) return ws.send(JSON.stringify({ type: "error", message: err.message }));
    sendList(ws, path.dirname(filePath));
  });
}

function handleDeleteMany(ws, paths) {
  paths.forEach(p => fs.rmSync(path.join(ROOT_DIR, p), { recursive: true, force: true }));
  sendList(ws, path.dirname(paths[0]));
}

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

server.listen(3000, () => console.log("Server running at http://localhost:3000"));
