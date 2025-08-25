window.token = new URLSearchParams(window.location.search).get("token");
  if (!window.token) {
    alert("Token missing! Go back to login.");
    window.location.href = "login.html";
  }

  const termBtn = document.getElementById("termBtn");
  const fmBtn = document.getElementById("fmBtn");
  const terminalPanel = document.getElementById("terminalPanel");
  const fmPanel = document.getElementById("fmPanel");

  function showTerminal(){
    terminalPanel.style.display = "flex";
    fmPanel.style.display = "none";
    termBtn.classList.add("active");
    fmBtn.classList.remove("active");
    if(window.fitAddon) fitAddon.fit();
  }

  function showFileManager(){
    terminalPanel.style.display = "none";
    fmPanel.style.display = "flex";
    fmBtn.classList.add("active");
    termBtn.classList.remove("active");
  }

  termBtn.onclick = showTerminal;
  fmBtn.onclick = showFileManager;

  const term = new Terminal({ cursorBlink:true, theme:{background:"#000", foreground:"#00ffea", cursor:"#00ffea"} });
  const fitAddon = new FitAddon.FitAddon();
  window.fitAddon = fitAddon;
  term.loadAddon(fitAddon);
  term.open(document.getElementById("terminal"));
  fitAddon.fit();
  window.addEventListener("resize",()=>fitAddon.fit());

  const wsTerm = new WebSocket(`ws://${location.host}/?token=${window.token}&type=terminal`);
  wsTerm.onmessage = e=>term.write(e.data);
  term.onData(d=>wsTerm.send(d));

  showTerminal(); // Başlangıç terminal