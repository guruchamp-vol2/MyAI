let isLogin = true;

document.addEventListener('DOMContentLoaded', () => {
  const authSubmit = document.getElementById('auth-submit');
  const toggleAuth = document.getElementById('toggle-auth');
  const authStatus = document.getElementById('auth-status');

  authSubmit.addEventListener('click', (e) => {
    e.preventDefault();
    handleAuth();
  });

  toggleAuth.addEventListener('click', () => {
    isLogin = !isLogin;
    authSubmit.textContent = isLogin ? '🔑 Login' : '📝 Sign Up';
    toggleAuth.textContent = isLogin ? 'Switch to Sign Up' : 'Switch to Login';
    authStatus.textContent = '';
  });
});

async function handleAuth() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value.trim();
  const status = document.getElementById('auth-status');

  if (!username || !password) {
    status.textContent = 'Please enter both fields.';
    return;
  }

  const route = isLogin ? '/login' : '/register';
  try {
    const res = await fetch(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
      if (data.token) {
        localStorage.setItem('token', data.token);
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
      } else {
        status.textContent = 'Unexpected response.';
      }
    } else {
      status.textContent = data.error || 'Authentication failed.';
    }
  } catch (err) {
    status.textContent = 'Request failed.';
  }
}

function logout() {
  localStorage.removeItem('token');
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('auth-container').style.display = 'block';
}

// ========== AI Assistant ==========

async function sendMessage() {
  if (!isLoggedIn() && guestLimitReached()) {
    setAuthStatus('Please log in to continue chatting.', true);
    showChatInputs(false);
    return;
  }
  const input = document.getElementById('message');
  const chatbox = document.getElementById('chatbox');
  const message = input.value.trim();
  if (!message) return;

  const userMessageDiv = document.createElement('div');
  userMessageDiv.className = 'message user-message';
  userMessageDiv.innerHTML = `<strong>You:</strong> ${message}`;
  chatbox.appendChild(userMessageDiv);

  input.value = '';
  chatbox.scrollTop = chatbox.scrollHeight;

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant-message';
  loadingDiv.innerHTML = '<strong>AI Assistant:</strong> Thinking...';
  chatbox.appendChild(loadingDiv);
  chatbox.scrollTop = chatbox.scrollHeight;

  const token = localStorage.getItem('token');

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    chatbox.removeChild(loadingDiv);
    const assistantMessageDiv = document.createElement('div');
    assistantMessageDiv.className = 'message assistant-message';
    assistantMessageDiv.innerHTML = `<strong>AI Assistant:</strong> ${data.reply}`;
    chatbox.appendChild(assistantMessageDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
    if (!isLoggedIn()) {
      incrementGuestQuestions();
      if (guestLimitReached()) {
        setAuthStatus('Please log in to continue chatting.', true);
        showChatInputs(false);
      }
    }
  } catch (error) {
    chatbox.removeChild(loadingDiv);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message assistant-message';
    errorDiv.innerHTML = '<strong>Error:</strong> Something went wrong.';
    chatbox.appendChild(errorDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  }
}

async function searchWeb() {
  const input = document.getElementById('searchQuery');
  const query = input.value.trim();
  if (!query) return;

  const chatbox = document.getElementById('chatbox');
  const userMessageDiv = document.createElement('div');
  userMessageDiv.className = 'message user-message';
  userMessageDiv.innerHTML = `<strong>You (search):</strong> ${query}`;
  chatbox.appendChild(userMessageDiv);
  input.value = '';
  chatbox.scrollTop = chatbox.scrollHeight;

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant-message';
  loadingDiv.innerHTML = '<strong>Searching...</strong> 🔍';
  chatbox.appendChild(loadingDiv);
  chatbox.scrollTop = chatbox.scrollHeight;

  try {
    const res = await fetch('/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ query })
    });

    const data = await res.json();
    chatbox.removeChild(loadingDiv);
    const resultDiv = document.createElement('div');
    resultDiv.className = 'message assistant-message';
    resultDiv.innerHTML = `<strong>Search Result:</strong> ${data.reply}`;
    chatbox.appendChild(resultDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  } catch (error) {
    chatbox.removeChild(loadingDiv);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message assistant-message';
    errorDiv.innerHTML = '<strong>Error:</strong> Search failed.';
    chatbox.appendChild(errorDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  }
}

async function uploadFile() {
  const input = document.getElementById('fileInput');
  if (!input.files[0]) {
    alert('Please select a file.');
    return;
  }

  const formData = new FormData();
  formData.append('file', input.files[0]);

  const chatbox = document.getElementById('chatbox');
  const userMessageDiv = document.createElement('div');
  userMessageDiv.className = 'message user-message';
  userMessageDiv.innerHTML = `<strong>You uploaded:</strong> ${input.files[0].name}`;
  chatbox.appendChild(userMessageDiv);
  chatbox.scrollTop = chatbox.scrollHeight;

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant-message';
  loadingDiv.innerHTML = '<strong>Analyzing file...</strong> 📁';
  chatbox.appendChild(loadingDiv);
  chatbox.scrollTop = chatbox.scrollHeight;

  try {
    const res = await fetch('/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
      body: formData
    });

    const data = await res.json();
    chatbox.removeChild(loadingDiv);
    const resultDiv = document.createElement('div');
    resultDiv.className = 'message assistant-message';
    resultDiv.innerHTML = `<strong>File Analysis:</strong> ${data.reply}`;
    chatbox.appendChild(resultDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
    input.value = '';
  } catch (error) {
    chatbox.removeChild(loadingDiv);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message assistant-message';
    errorDiv.innerHTML = '<strong>Error:</strong> Upload failed.';
    chatbox.appendChild(errorDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  }
}

function startVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
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
  chatbox.scrollTop = chatbox.scrollHeight;

  recognition.start();

  recognition.onresult = function (event) {
    const voiceInput = event.results[0][0].transcript;
    document.getElementById('message').value = voiceInput;
    chatbox.removeChild(listeningDiv);
    sendMessage();
  };

  recognition.onerror = function () {
    chatbox.removeChild(listeningDiv);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message assistant-message';
    errorDiv.innerHTML = '<strong>Voice Error:</strong> Could not recognize speech.';
    chatbox.appendChild(errorDiv);
  };

  recognition.onend = function () {
    if (chatbox.contains(listeningDiv)) {
      chatbox.removeChild(listeningDiv);
    }
  };
}

// --- Auth & UI Logic ---
function showChat() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('chat-section').style.display = '';
}

function showAuth() {
  document.getElementById('auth-section').style.display = '';
  document.getElementById('chat-section').style.display = 'none';
}

function showChatInputs(enabled) {
  document.getElementById('message').disabled = !enabled;
  document.getElementById('searchQuery').disabled = !enabled;
  document.getElementById('fileInput').disabled = !enabled;
  document.querySelectorAll('.chat-container button').forEach(btn => btn.disabled = !enabled);
  if (!enabled) {
    document.getElementById('message').placeholder = 'Login to chat...';
  } else {
    document.getElementById('message').placeholder = 'Type your message...';
  }
}

function isLoggedIn() {
  return !!localStorage.getItem('token');
}

function setAuthStatus(msg, isError = false) {
  const el = document.getElementById('authStatus');
  el.innerText = msg;
  el.style.color = isError ? 'red' : 'green';
}

async function login() {
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
    setAuthStatus('Login successful!');
    showChatInputs(true);
  } else {
    setAuthStatus(data.error || 'Login failed', true);
  }
}

async function signup() {
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const res = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.message) {
    setAuthStatus('Signup successful! Please login.');
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-password').value = '';
  } else {
    setAuthStatus(data.error || 'Signup failed', true);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('login-btn').onclick = login;
  document.getElementById('signup-btn').onclick = signup;
  showChatInputs(isLoggedIn() || canAskGuest());
});

// --- Guest Question Limit ---
function canAskGuest() {
  if (isLoggedIn()) return true;
  const count = parseInt(localStorage.getItem('guestQuestions') || '0', 10);
  return count < 5;
}

function incrementGuestQuestions() {
  if (isLoggedIn()) return;
  let count = parseInt(localStorage.getItem('guestQuestions') || '0', 10);
  count++;
  localStorage.setItem('guestQuestions', count);
}

function guestLimitReached() {
  return !isLoggedIn() && parseInt(localStorage.getItem('guestQuestions') || '0', 10) >= 5;
}
