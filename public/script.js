async function sendMessage() {
    const input = document.getElementById('message');
    const chatbox = document.getElementById('chatbox');
    const message = input.value.trim();
    if (!message) return;
  
    // Add user message with proper styling
    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = 'message user-message';
    userMessageDiv.innerHTML = `<strong>You:</strong> ${message}`;
    chatbox.appendChild(userMessageDiv);
  
    input.value = '';
    chatbox.scrollTop = chatbox.scrollHeight;
  
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant-message';
    loadingDiv.innerHTML = '<strong>AI Assistant:</strong> Thinking...';
    chatbox.appendChild(loadingDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  
    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
  
      const data = await res.json();
      
      // Remove loading message and add response
      chatbox.removeChild(loadingDiv);
      const assistantMessageDiv = document.createElement('div');
      assistantMessageDiv.className = 'message assistant-message';
      assistantMessageDiv.innerHTML = `<strong>AI Assistant:</strong> ${data.reply}`;
      chatbox.appendChild(assistantMessageDiv);
      chatbox.scrollTop = chatbox.scrollHeight;
    } catch (error) {
      // Remove loading message and show error
      chatbox.removeChild(loadingDiv);
      const errorDiv = document.createElement('div');
      errorDiv.className = 'message assistant-message';
      errorDiv.innerHTML = '<strong>Error:</strong> Sorry, something went wrong. Please try again.';
      chatbox.appendChild(errorDiv);
      chatbox.scrollTop = chatbox.scrollHeight;
    }
  }
  
  async function searchWeb() {
    const input = document.getElementById('searchQuery');
    const query = input.value.trim();
    if (!query) return;
  
    const chatbox = document.getElementById('chatbox');
    
    // Add user search message
    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = 'message user-message';
    userMessageDiv.innerHTML = `<strong>You (search):</strong> ${query}`;
    chatbox.appendChild(userMessageDiv);
  
    input.value = '';
    chatbox.scrollTop = chatbox.scrollHeight;
  
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant-message';
    loadingDiv.innerHTML = '<strong>Searching...</strong> 🔍';
    chatbox.appendChild(loadingDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  
    try {
      const res = await fetch('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
  
      const data = await res.json();
      
      // Remove loading message and add response
      chatbox.removeChild(loadingDiv);
      const searchResultDiv = document.createElement('div');
      searchResultDiv.className = 'message assistant-message';
      searchResultDiv.innerHTML = `<strong>Search Result:</strong> ${data.reply}`;
      chatbox.appendChild(searchResultDiv);
      chatbox.scrollTop = chatbox.scrollHeight;
    } catch (error) {
      // Remove loading message and show error
      chatbox.removeChild(loadingDiv);
      const errorDiv = document.createElement('div');
      errorDiv.className = 'message assistant-message';
      errorDiv.innerHTML = '<strong>Error:</strong> Search failed. Please try again.';
      chatbox.appendChild(errorDiv);
      chatbox.scrollTop = chatbox.scrollHeight;
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
    
    // Add user upload message
    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = 'message user-message';
    userMessageDiv.innerHTML = `<strong>You uploaded:</strong> ${input.files[0].name}`;
    chatbox.appendChild(userMessageDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant-message';
    loadingDiv.innerHTML = '<strong>Analyzing file...</strong> 📁';
    chatbox.appendChild(loadingDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  
    try {
      const res = await fetch('/upload', {
        method: 'POST',
        body: formData
      });
  
      const data = await res.json();
      
      // Remove loading message and add response
      chatbox.removeChild(loadingDiv);
      const fileResultDiv = document.createElement('div');
      fileResultDiv.className = 'message assistant-message';
      fileResultDiv.innerHTML = `<strong>File Analysis:</strong> ${data.reply}`;
      chatbox.appendChild(fileResultDiv);
      chatbox.scrollTop = chatbox.scrollHeight;
      
      // Clear file input
      input.value = '';
    } catch (error) {
      // Remove loading message and show error
      chatbox.removeChild(loadingDiv);
      const errorDiv = document.createElement('div');
      errorDiv.className = 'message assistant-message';
      errorDiv.innerHTML = '<strong>Error:</strong> File upload failed. Please try again.';
      chatbox.appendChild(errorDiv);
      chatbox.scrollTop = chatbox.scrollHeight;
    }
  }
  
  function startVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
  
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    // Show voice listening indicator
    const chatbox = document.getElementById('chatbox');
    const listeningDiv = document.createElement('div');
    listeningDiv.className = 'message assistant-message';
    listeningDiv.innerHTML = '<strong>Listening...</strong> 🎤 Speak now';
    chatbox.appendChild(listeningDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  
    recognition.start();
    
    recognition.onresult = function(event) {
      const voiceInput = event.results[0][0].transcript;
      document.getElementById('message').value = voiceInput;
      
      // Remove listening indicator
      chatbox.removeChild(listeningDiv);
      
      // Auto-send the message
      sendMessage();
    };
    
    recognition.onerror = function(event) {
      chatbox.removeChild(listeningDiv);
      const errorDiv = document.createElement('div');
      errorDiv.className = 'message assistant-message';
      errorDiv.innerHTML = '<strong>Voice Error:</strong> Could not recognize speech. Please try again.';
      chatbox.appendChild(errorDiv);
      chatbox.scrollTop = chatbox.scrollHeight;
    };
    
    recognition.onend = function() {
      // Remove listening indicator if it still exists
      if (chatbox.contains(listeningDiv)) {
        chatbox.removeChild(listeningDiv);
      }
    };
  }
  
  // Add Enter key support for text inputs
  document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('message');
    const searchInput = document.getElementById('searchQuery');
    
    messageInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
    
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchWeb();
      }
    });
  });
  