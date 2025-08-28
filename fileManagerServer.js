const WebSocket = require("ws"); 
const fs = require("fs"); 
const path = require("path"); 
const wss = new WebSocket.Server({ port: 8080 }); 
const archiver = require("archiver"); 
let ROOT_DIR = path.join("/"); 

wss.on("connection", ws => {
    ws.on("message", msg => {
        const data = JSON.parse(msg); if (data.type === "list") {
            const dirPath = path.join(ROOT_DIR, data.path || "."); fs.readdir(dirPath, { withFileTypes: true }, (err, files) => {
                if (err) return; let items = files.map(f => ({ name: f.name, isDir: f.isDirectory() }));
                // root değilse .. ekle 
                if ((data.path || ".") !== ".") { items.unshift({ name: "..", isDir: true, isUp: true }); } ws.send(JSON.stringify({ type: "list", path: data.path || ".", files: items }));
            });
        } 
        
        if (data.type === "download") {
            const filePath = path.join(ROOT_DIR, data.path);

            fs.stat(filePath, (err, stats) => {
                if (err) return;

                if (stats.isFile()) {
                fs.readFile(filePath, (err, content) => {
                    if (err) return;
                    ws.send(JSON.stringify({
                    type: "download",
                    filename: path.basename(filePath),
                    content: content.toString("base64")
                    }));
                });

                } else if (stats.isDirectory()) {
                const zipPath = filePath + ".zip";
                const output = fs.createWriteStream(zipPath);
                const archive = archiver("zip", { zlib: { level: 9 } });

                output.on("close", () => {
                    fs.readFile(zipPath, (err, content) => {
                    if (err) return;
                    ws.send(JSON.stringify({
                        type: "download",
                        filename: path.basename(filePath) + ".zip",
                        content: content.toString("base64")
                    }));
                    fs.unlink(zipPath, () => {}); 
                    });
                });

                archive.pipe(output);
                archive.directory(filePath, false);
                archive.finalize();
                }
            });
            }

        if (data.type === "upload") {
            const dirPath = path.join(ROOT_DIR, data.path); // abc/abc/
            const filePath = path.join(dirPath, data.filename); // abc/abc/js/file.js
            const buffer = Buffer.from(data.content, "base64");

            // klasör yoksa oluştur
            fs.mkdir(dirPath, { recursive: true }, (err) => {
                if (err) {
                ws.send(JSON.stringify({ type: "error", message: err.message }));
                return;
                }
                fs.writeFile(filePath, buffer, (err) => {
                if (err) {
                    ws.send(JSON.stringify({ type: "error", message: err.message }));
                    return;
                }
                ws.send(JSON.stringify({ type: "upload", status: "ok" }));
                });
            });
            sendList(ws, '.');
        }
        if (data.type === "delete") {
            const filePath = path.join(ROOT_DIR, data.path);
            fs.rm(filePath, { recursive: true, force: true }, err => {
                if (err) { ws.send(JSON.stringify({ type: "error", message: err.message })); return; }
                const parentPath = path.dirname(data.path);
                fs.readdir(path.join(ROOT_DIR, parentPath), { withFileTypes: true }, (err, files) => {
                    if (err) return; let items = files.map(f => ({ name: f.name, isDir: f.isDirectory() }));
                    if (parentPath !== "." && parentPath !== "/") { items.unshift({ name: "..", isDir: true, isUp: true }); }
                    ws.send(JSON.stringify({ type: "list", path: parentPath, files: items }));
                });
            });
            sendList(ws, '.');
        }
        if (data.type === "deleteMany") { 
            let errors = []; 
            data.paths.forEach(p => { 
                try { 
                    fs.rmSync(path.join(ROOT_DIR, p), { recursive: true, force: true }); 
                } catch (err) { 
                    errors.push({ file: p, error: err.message }); 
                } 
            }); 
            const basePath = path.dirname(data.paths[0]); 
            fs.readdir(path.join(ROOT_DIR, basePath), { withFileTypes: true }, (err, files) => { 
                if (err) return; 
                let items = files.map(f => ({ name: f.name, isDir: f.isDirectory() })); 
                if (basePath !== "." && basePath !== "/") { 
                    items.unshift({ name: "..", isDir: true, isUp: true }); 
                } ws.send(JSON.stringify({ type: "list", path: basePath, files: items })); 
            }); if (errors.length > 0) { 
                ws.send(JSON.stringify({ type: "error", message: "internal exception occured", details: errors })); 
            } 
            sendList(ws, path.dirname(data.paths[0]));
        }
    });
}); 

function sendList(ws, dirPath) {
  fs.readdir(path.join(ROOT_DIR, dirPath), { withFileTypes: true }, (err, files) => {
    if (err) return;
    ws.send(JSON.stringify({
      type: "list",
      path: dirPath,
      files: files.map(f => ({
        name: f.name,
        isDir: f.isDirectory()
      }))
    }));
  });
}

const express = require("express"); const app = express(); const http = require("http").createServer(app);

app.use(express.static(path.join(__dirname, "public")));
http.listen(3000, () => { console.log("Web app running at http://localhost:3000"); });