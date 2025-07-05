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
  userMessageDiv.innerHTML = `<strong>You:</strong> ${escapeHtml(message)}`;
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
    assistantMessageDiv.innerHTML = `<strong>AI Assistant:</strong> ${escapeHtml(data.reply)}`;
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

// XSS Protection: Escape HTML to prevent script injection
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Search history and suggestions
let searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
let searchSuggestions = [];

async function searchWeb() {
  const input = document.getElementById('searchQuery');
  const query = input.value.trim();
  if (!query) return;

  // Add to search history
  if (!searchHistory.includes(query)) {
    searchHistory.unshift(query);
    searchHistory = searchHistory.slice(0, 10); // Keep last 10 searches
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
  }

  const chatbox = document.getElementById('chatbox');
  const userMessageDiv = document.createElement('div');
  userMessageDiv.className = 'message user-message';
  userMessageDiv.innerHTML = `<strong>🔍 Search:</strong> ${escapeHtml(query)}`;
  chatbox.appendChild(userMessageDiv);
  input.value = '';
  chatbox.scrollTop = chatbox.scrollHeight;

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant-message';
  loadingDiv.innerHTML = '<strong>🤖 AI Search Assistant:</strong> Searching multiple sources and analyzing results...';
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
    
    // Format the response with better styling and XSS protection
    const formattedReply = escapeHtml(data.reply)
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
    
    resultDiv.innerHTML = `<strong>🤖 AI Search Results:</strong><br>${formattedReply}`;
    chatbox.appendChild(resultDiv);
    chatbox.scrollTop = chatbox.scrollHeight;

    // Show search suggestions based on the query
    showSearchSuggestions(query);
    
    // Track successful search
    trackSearchAnalytics(query, true);
    
  } catch (error) {
    chatbox.removeChild(loadingDiv);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message assistant-message';
    errorDiv.innerHTML = '<strong>❌ Search Error:</strong> Unable to complete search. Please try again or check your connection.';
    chatbox.appendChild(errorDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
    
    // Track failed search
    trackSearchAnalytics(query, false);
  }
}

async function trackSearchAnalytics(query, success) {
  try {
    await fetch('/search-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, success })
    });
  } catch (error) {
    // Analytics tracking failed, but don't show error to user
    console.log('Analytics tracking failed:', error);
  }
}

function showSearchSuggestions(query) {
  // Generate related search suggestions
  const suggestions = generateSearchSuggestions(query);
  if (suggestions.length > 0) {
    // Create hover tooltip instead of chat message
    createSearchTooltip(suggestions);
  }
}

function createSearchTooltip(suggestions) {
  // Remove existing tooltip
  const existingTooltip = document.getElementById('search-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }

  const searchInput = document.getElementById('searchQuery');
  const tooltip = document.createElement('div');
  tooltip.id = 'search-tooltip';
  tooltip.className = 'search-tooltip';
  
  tooltip.innerHTML = `
    <div class="tooltip-header">💡 Related searches:</div>
    <div class="tooltip-suggestions">
      ${suggestions.map(suggestion => 
        `<button class="tooltip-suggestion-btn" onclick="searchSuggestion('${escapeHtml(suggestion)}')">${escapeHtml(suggestion)}</button>`
      ).join('')}
    </div>
  `;
  
  // Position tooltip near search input
  const rect = searchInput.getBoundingClientRect();
  tooltip.style.position = 'absolute';
  tooltip.style.top = `${rect.bottom + 5}px`;
  tooltip.style.left = `${rect.left}px`;
  tooltip.style.zIndex = '1000';
  
  document.body.appendChild(tooltip);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (tooltip.parentNode) {
      tooltip.remove();
    }
  }, 5000);
}

function hideSearchTooltip() {
  const tooltip = document.getElementById('search-tooltip');
  if (tooltip) {
    tooltip.remove();
  }
}

function generateSearchSuggestions(query) {
  const suggestions = [];
  const words = query.toLowerCase().split(' ');
  
  // Add variations of the original query
  if (words.length > 1) {
    suggestions.push(words.slice(0, -1).join(' '));
    suggestions.push(words.slice(1).join(' '));
  }
  
  // Add common search modifiers
  const modifiers = ['latest', 'news', 'guide', 'tutorial', 'examples', 'definition'];
  modifiers.forEach(modifier => {
    if (!query.toLowerCase().includes(modifier)) {
      suggestions.push(`${query} ${modifier}`);
    }
  });
  
  return suggestions.slice(0, 4); // Limit to 4 suggestions
}

function searchSuggestion(suggestion) {
  document.getElementById('searchQuery').value = suggestion;
  hideSearchTooltip();
  searchWeb();
}

// Enhanced search input with history dropdown
function setupSearchInput() {
  const searchInput = document.getElementById('searchQuery');
  
  searchInput.addEventListener('focus', () => {
    showSearchHistory();
  });
  
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (query.length > 2) {
      showSearchSuggestions(query);
    } else {
      hideSearchTooltip();
    }
  });
  
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      hideSearchTooltip();
      searchWeb();
    }
  });
  
  // Hide tooltip when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-input-container') && 
        !e.target.closest('#searchHistoryDropdown') && 
        !e.target.closest('#search-tooltip')) {
      hideSearchTooltip();
      hideSearchSuggestions();
    }
  });
}

function showSearchHistory() {
  if (searchHistory.length === 0) return;
  
  let historyDiv = document.getElementById('searchHistoryDropdown');
  if (!historyDiv) {
    historyDiv = document.createElement('div');
    historyDiv.id = 'searchHistoryDropdown';
    historyDiv.className = 'search-history-dropdown';
    document.getElementById('searchQuery').parentNode.appendChild(historyDiv);
  }
  
  historyDiv.innerHTML = `
    <div class="history-header">Recent searches:</div>
    ${searchHistory.map(item => 
      `<div class="history-item" onclick="selectHistoryItem('${item}')">${item}</div>`
    ).join('')}
    <div class="history-clear" onclick="clearSearchHistory()">Clear history</div>
  `;
  historyDiv.style.display = 'block';
}

function hideSearchSuggestions() {
  const historyDiv = document.getElementById('searchHistoryDropdown');
  if (historyDiv) {
    historyDiv.style.display = 'none';
  }
}

function selectHistoryItem(item) {
  document.getElementById('searchQuery').value = item;
  hideSearchSuggestions();
}

function clearSearchHistory() {
  searchHistory = [];
  localStorage.removeItem('searchHistory');
  hideSearchSuggestions();
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

// Initialize enhanced search features when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Setup authentication
  document.getElementById('login-btn').onclick = login;
  document.getElementById('signup-btn').onclick = signup;
  showChatInputs(isLoggedIn() || canAskGuest());
  
  // Setup enhanced search features
  setupSearchInput();
  loadTrendingSearches();
  
  // Update timestamp
  updateLastUpdated();
  
  // Setup PWA install functionality
  setupPWAInstall();
  
  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered successfully:', registration);
      })
      .catch(error => {
        console.log('Service Worker registration failed:', error);
      });
  }
  
  // Hide search history when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-input-container') && !e.target.closest('#searchHistoryDropdown')) {
      hideSearchSuggestions();
    }
  });
});

function updateLastUpdated() {
  const now = new Date();
  const timeString = now.toLocaleString();
  const lastUpdatedElement = document.getElementById('last-updated');
  if (lastUpdatedElement) {
    lastUpdatedElement.textContent = timeString;
  }
}

async function loadTrendingSearches() {
  try {
    console.log('Loading trending searches...');
    const response = await fetch('/popular-searches');
    const data = await response.json();
    
    const trendingContainer = document.getElementById('trending-searches');
    if (!trendingContainer) {
      console.error('Trending container not found');
      return;
    }
    
    console.log('Trending data:', data);
    
    if (data.popular && data.popular.length > 0) {
      trendingContainer.innerHTML = data.popular.map(item => 
        `<button class="trending-item" onclick="searchTrending('${item.query}')">
          ${item.query}<span class="trending-count">(${item.count})</span>
        </button>`
      ).join('');
    } else {
      trendingContainer.innerHTML = '<div class="trending-placeholder">No trending searches yet. Be the first to search!</div>';
    }
  } catch (error) {
    console.error('Failed to load trending searches:', error);
    const trendingContainer = document.getElementById('trending-searches');
    if (trendingContainer) {
      trendingContainer.innerHTML = '<div class="trending-placeholder">Unable to load trending searches</div>';
    }
  }
}

function searchTrending(query) {
  document.getElementById('searchQuery').value = query;
  searchWeb();
}

// PWA Install functionality
let deferredPrompt;

function setupPWAInstall() {
  // Listen for the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    // Show the install button
    showInstallButton();
  });

  // Listen for successful installation
  window.addEventListener('appinstalled', (evt) => {
    console.log('App was installed');
    hideInstallButton();
    showInstallSuccess();
  });

  // Check if app is already installed
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('App is already installed');
    hideInstallButton();
  }
}

function showInstallButton() {
  const installContainer = document.getElementById('install-container');
  const installButton = document.getElementById('install-button');
  
  if (installContainer && installButton) {
    installContainer.style.display = 'block';
    
    // Add click handler
    installButton.onclick = installApp;
  }
}

function hideInstallButton() {
  const installContainer = document.getElementById('install-container');
  if (installContainer) {
    installContainer.style.display = 'none';
  }
}

function installApp() {
  if (deferredPrompt) {
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      // Clear the deferredPrompt
      deferredPrompt = null;
    });
  } else {
    // Fallback for browsers that don't support beforeinstallprompt
    showInstallInstructions();
  }
}

function showInstallInstructions() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  
  let instructions = '';
  
  if (isIOS) {
    instructions = `
      <div style="background: white; padding: 20px; border-radius: 10px; margin: 10px 0;">
        <h3>📱 Install MyAI on iPhone</h3>
        <ol>
          <li>Tap the <strong>Share</strong> button (square with arrow)</li>
          <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
          <li>Tap <strong>"Add"</strong></li>
          <li>Your app will appear on your home screen!</li>
        </ol>
      </div>
    `;
  } else if (isAndroid) {
    instructions = `
      <div style="background: white; padding: 20px; border-radius: 10px; margin: 10px 0;">
        <h3>📱 Install MyAI on Android</h3>
        <ol>
          <li>Tap the <strong>three dots menu</strong> (⋮)</li>
          <li>Tap <strong>"Add to Home screen"</strong></li>
          <li>Tap <strong>"Add"</strong></li>
          <li>Your app will appear on your home screen!</li>
        </ol>
      </div>
    `;
  } else {
    instructions = `
      <div style="background: white; padding: 20px; border-radius: 10px; margin: 10px 0;">
        <h3>📱 Install MyAI App</h3>
        <p>To install this app:</p>
        <ul>
          <li><strong>Chrome/Edge:</strong> Look for the install icon in the address bar</li>
          <li><strong>Mobile:</strong> Use the browser's "Add to Home Screen" option</li>
        </ul>
      </div>
    `;
  }
  
  // Add instructions to the page
  const chatbox = document.getElementById('chatbox');
  const instructionDiv = document.createElement('div');
  instructionDiv.className = 'message assistant-message';
  instructionDiv.innerHTML = instructions;
  chatbox.appendChild(instructionDiv);
  chatbox.scrollTop = chatbox.scrollHeight;
}

function showInstallSuccess() {
  const chatbox = document.getElementById('chatbox');
  const successDiv = document.createElement('div');
  successDiv.className = 'message assistant-message';
  successDiv.innerHTML = `
    <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 10px; border: 1px solid #c3e6cb;">
      <h3>🎉 App Installed Successfully!</h3>
      <p>MyAI is now installed on your device. You can:</p>
      <ul>
        <li>Access it from your home screen</li>
        <li>Use it like a native app</li>
        <li>Get automatic updates</li>
      </ul>
    </div>
  `;
  chatbox.appendChild(successDiv);
  chatbox.scrollTop = chatbox.scrollHeight;
}
