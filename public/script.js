function showApp() {
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("app-container").style.display = "block";
}

function showLogin() {
  document.getElementById("auth-container").style.display = "block";
  document.getElementById("app-container").style.display = "none";
}

function saveToken(token) {
  localStorage.setItem("token", token);
}

function getToken() {
  return localStorage.getItem("token");
}

function logout() {
  localStorage.removeItem("token");
  showLogin();
}

async function login() {
  const username = document.getElementById("auth-username").value;
  const password = document.getElementById("auth-password").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (data.token) {
    saveToken(data.token);
    showApp();
  } else {
    document.getElementById("auth-status").textContent = data.error || "Login failed";
  }
}

async function register() {
  const username = document.getElementById("auth-username").value;
  const password = document.getElementById("auth-password").value;

  const res = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (data.message) {
    login(); // auto-login
  } else {
    document.getElementById("auth-status").textContent = data.error || "Signup failed";
  }
}

async function sendMessage() {
  const input = document.getElementById('message');
  const chatbox = document.getElementById('chatbox');
  const message = input.value.trim();
  if (!message) return;

  chatbox.innerHTML += `<div class="message user-message"><strong>You:</strong> ${message}</div>`;
  input.value = '';
  chatbox.scrollTop = chatbox.scrollHeight;

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant-message';
  loadingDiv.innerHTML = '<strong>AI Assistant:</strong> Thinking...';
  chatbox.appendChild(loadingDiv);

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    chatbox.removeChild(loadingDiv);
    chatbox.innerHTML += `<div class="message assistant-message"><strong>AI Assistant:</strong> ${data.reply}</div>`;
    chatbox.scrollTop = chatbox.scrollHeight;
  } catch {
    chatbox.removeChild(loadingDiv);
    chatbox.innerHTML += `<div class="message assistant-message"><strong>Error:</strong> Sorry, something went wrong.</div>`;
  }
}

async function searchWeb() {
  const input = document.getElementById('searchQuery');
  const query = input.value.trim();
  if (!query) return;

  const chatbox = document.getElementById('chatbox');
  chatbox.innerHTML += `<div class="message user-message"><strong>You (search):</strong> ${query}</div>`;
  input.value = '';

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant-message';
  loadingDiv.innerHTML = '<strong>Searching...</strong> 🔍';
  chatbox.appendChild(loadingDiv);

  try {
    const res = await fetch('/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ query })
    });

    const data = await res.json();
    chatbox.removeChild(loadingDiv);
    chatbox.innerHTML += `<div class="message assistant-message"><strong>Search Result:</strong> ${data.reply}</div>`;
    chatbox.scrollTop = chatbox.scrollHeight;
  } catch {
    chatbox.removeChild(loadingDiv);
    chatbox.innerHTML += `<div class="message assistant-message"><strong>Error:</strong> Search failed.</div>`;
  }
}

async function uploadFile() {
  const input = document.getElementById('fileInput');
  if (!input.files[0]) {
    alert('Please select a file first.');
    return;
  }

  const formData = new FormData();
  formData.append('file', input.files[0]);

  const chatbox = document.getElementById('chatbox');
  chatbox.innerHTML += `<div class="message user-message"><strong>You uploaded:</strong> ${input.files[0].name}</div>`;

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant-message';
  loadingDiv.innerHTML = '<strong>Analyzing file...</strong> 📁';
  chatbox.appendChild(loadingDiv);

  try {
    const res = await fetch('/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    });

    const data = await res.json();
    chatbox.removeChild(loadingDiv);
    chatbox.innerHTML += `<div class="message assistant-message"><strong>File Analysis:</strong> ${data.reply}</div>`;
    input.value = '';
  } catch {
    chatbox.removeChild(loadingDiv);
    chatbox.innerHTML += `<div class="message assistant-message"><strong>Error:</strong> File upload failed.</div>`;
  }
}

function startVoice() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    alert('Speech recognition not supported.');
    return;
  }

  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;

  const chatbox = document.getElementById('chatbox');
  const listeningDiv = document.createElement('div');
  listeningDiv.className = 'message assistant-message';
  listeningDiv.innerHTML = '<strong>Listening...</strong> 🎤 Speak now';
  chatbox.appendChild(listeningDiv);

  recognition.start();

  recognition.onresult = (event) => {
    document.getElementById('message').value = event.results[0][0].transcript;
    chatbox.removeChild(listeningDiv);
    sendMessage();
  };

  recognition.onerror = () => {
    chatbox.removeChild(listeningDiv);
    chatbox.innerHTML += `<div class="message assistant-message"><strong>Voice Error:</strong> Could not recognize speech.</div>`;
  };

  recognition.onend = () => {
    if (chatbox.contains(listeningDiv)) {
      chatbox.removeChild(listeningDiv);
    }
  };
}

document.addEventListener("DOMContentLoaded", () => {
  if (getToken()) {
    showApp();
  }
});
