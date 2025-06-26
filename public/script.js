async function sendMessage() {
    const input = document.getElementById('message');
    const chatbox = document.getElementById('chatbox');
    const message = input.value.trim();
    if (!message) return;
  
    chatbox.innerHTML += `<p><b>You:</b> ${message}</p>`;
    input.value = '';
  
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
  
    const data = await res.json();
    chatbox.innerHTML += `<p><b>Assistant:</b> ${data.reply}</p>`;
    chatbox.scrollTop = chatbox.scrollHeight;
  }
  
  async function searchWeb() {
    const input = document.getElementById('searchQuery');
    const query = input.value.trim();
    if (!query) return;
  
    const chatbox = document.getElementById('chatbox');
    chatbox.innerHTML += `<p><b>You (search):</b> ${query}</p>`;
    input.value = '';
  
    const res = await fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
  
    const data = await res.json();
    chatbox.innerHTML += `<p><b>Search Result:</b> ${data.reply}</p>`;
    chatbox.scrollTop = chatbox.scrollHeight;
  }
  
  async function uploadFile() {
    const input = document.getElementById('fileInput');
    if (!input.files[0]) return;
  
    const formData = new FormData();
    formData.append('file', input.files[0]);
  
    const chatbox = document.getElementById('chatbox');
    chatbox.innerHTML += `<p><b>You uploaded:</b> ${input.files[0].name}</p>`;
  
    const res = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
  
    const data = await res.json();
    chatbox.innerHTML += `<p><b>File Summary:</b> ${data.reply}</p>`;
  }
  
  function startVoice() {
    const recognition = new(window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.start();
    recognition.onresult = function(event) {
      const voiceInput = event.results[0][0].transcript;
      document.getElementById('message').value = voiceInput;
      sendMessage();
    };
  }
  