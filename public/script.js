    const remoteList = document.getElementById("remoteFiles");
    const localList = document.getElementById("localFiles");
    const remoteSearch = document.getElementById("remoteSearch");
    let uploadPath = ".";
    let remoteFilesCache = [];
    let selectedFiles = new Set();

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    if (!token) {
      alert("Token missing! Go back to login.");
      window.location.href = "login.html";
    }
    const ws = new WebSocket(`ws://${location.host}/?token=${token}&type=filemanager`);

    ws.onopen = () => ws.send(JSON.stringify({ type: "list", path: "." }));

    ws.onmessage = e => {
      const data = JSON.parse(e.data);
      if (data.type === "list") {
        remoteFilesCache = data.files;
        renderRemote(remoteFilesCache, data.path);
      }
      if (data.type === "download") {
        const blob = new Blob([Uint8Array.from(atob(data.content), c => c.charCodeAt(0))]);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = data.filename;
        a.click();
      }
    };

    function renderRemote(files, path) {
      uploadPath = path;
      remoteList.innerHTML = "";

      files.forEach(f => {
        const li = document.createElement("li");
        li.dataset.path = path + "/" + f.name;

        const nameSpan = document.createElement("span");
        nameSpan.textContent = f.name;
        if (f.isDir) li.classList.add("directory");

        const selectBtn = document.createElement("button");
        selectBtn.textContent = "Choose";
        selectBtn.onclick = (e) => {
          e.stopPropagation(); 
          if (li.classList.contains("selected")) {
            li.classList.remove("selected");
            selectedFiles.delete(li.dataset.path);
          } else {
            li.classList.add("selected");
            selectedFiles.add(li.dataset.path);
          }
        };

        li.onclick = () => {
          if (f.isDir) {
            const newPath = (path === "." ? f.name : path + "/" + f.name);
            ws.send(JSON.stringify({ 
              type:"list", 
              path:f.isUp ? path.split("/").slice(0,-1).join("/") || "." : newPath 
            }));
          } else {
            if (li.classList.contains("selected")) {
              li.classList.remove("selected");
              selectedFiles.delete(li.dataset.path);
            } else {
              li.classList.add("selected");
              selectedFiles.add(li.dataset.path);
            }
          }
        };

        li.appendChild(nameSpan);
        li.appendChild(selectBtn); // butonu ekle
        remoteList.appendChild(li);
      });
    }


    document.getElementById("deleteSelectedBtn").addEventListener("click", () => {
      if (selectedFiles.size === 0) return alert("No file selected!");
      if (confirm(`${selectedFiles.size} deleting ?`)) {
        ws.send(JSON.stringify({
          type: "deleteMany",
          paths: Array.from(selectedFiles)
        }));
        selectedFiles.clear();
      }
    });

    document.getElementById("downloadSelectedBtn").addEventListener("click", () => {
      if (selectedFiles.size === 0) return alert("No file selected!");
      Array.from(selectedFiles).forEach(path => {
        ws.send(JSON.stringify({ type:"download", path }));
      });
    });

    document.getElementById("localPicker").addEventListener("change", e => {
      renderLocal([...e.target.files]);
    });

    document.getElementById("uploadAllBtn").addEventListener("click", () => {
      [...localList.querySelectorAll("li")].forEach(li => {
        uploadFile(li.fileRef);
      });
    });


    function renderLocal(files) {
      localList.innerHTML = "";
      files.forEach(file => {
        const li = document.createElement("li");
        li.textContent = file.webkitRelativePath || file.name; // klasör yapısını göster
        li.fileRef = file;

        const uploadBtn = document.createElement("button");
        uploadBtn.textContent = "Upload";
        uploadBtn.onclick = () => uploadFile(file);

        li.appendChild(uploadBtn);
        localList.appendChild(li);
      });
    }


    function uploadFile(file) {
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const relativePath = file.webkitRelativePath
          ? file.webkitRelativePath.replace(/[^/]+$/, '')
          : '';
        const targetPath = uploadPath === "." ? relativePath : uploadPath + "/" + relativePath;
        ws.send(JSON.stringify({
          type: "upload",
          path: targetPath,
          filename: file.name,
          content: btoa(binary)
        }));
      };
      reader.readAsArrayBuffer(file);
    }

    remoteSearch.addEventListener("input", () => {
      const term = remoteSearch.value.toLowerCase();
      const filtered = remoteFilesCache.filter(f => f.name.toLowerCase().includes(term));
      renderRemote(filtered, uploadPath);
    });

    function chooseFiles() {
      const input = document.getElementById("localPicker");
      input.removeAttribute("webkitdirectory");
      input.removeAttribute("directory");
      input.click();
    }

    function chooseFolder() {
      const input = document.getElementById("localPicker");
      input.setAttribute("webkitdirectory", "");
      input.setAttribute("directory", "");
      input.click();
    }

    document.getElementById("localPicker").addEventListener("change", e => {
      renderLocal([...e.target.files]);
    });