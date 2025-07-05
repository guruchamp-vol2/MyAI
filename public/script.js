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
  const userText = document.createElement('strong');
  userText.innerText = 'You: ';
  const userMessage = document.createTextNode(message);
  userMessageDiv.appendChild(userText);
  userMessageDiv.appendChild(userMessage);
  chatbox.appendChild(userMessageDiv);

  input.value = '';
  chatbox.scrollTop = chatbox.scrollHeight;

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant-message';
  const loadingText = document.createElement('strong');
  loadingText.innerText = 'AI Assistant: ';
  const loadingMessage = document.createTextNode('Thinking...');
  loadingDiv.appendChild(loadingText);
  loadingDiv.appendChild(loadingMessage);
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
    const assistantText = document.createElement('strong');
    assistantText.innerText = 'AI Assistant: ';
    const assistantMessage = document.createTextNode(data.reply);
    assistantMessageDiv.appendChild(assistantText);
    assistantMessageDiv.appendChild(assistantMessage);
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
    const errorText = document.createElement('strong');
    errorText.innerText = 'Error: ';
    const errorMessage = document.createTextNode('Something went wrong.');
    errorDiv.appendChild(errorText);
    errorDiv.appendChild(errorMessage);
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
let searchDebounceTimer = null;

async function searchWeb() {
  const input = document.getElementById('searchQuery');
  const query = input.value.trim();
  if (!query) return;

  // Hide any existing tooltip when searching
  hideSearchTooltip();

  // Add to search history
  if (!searchHistory.includes(query)) {
    searchHistory.unshift(query);
    searchHistory = searchHistory.slice(0, 10); // Keep last 10 searches
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
  }

  const chatbox = document.getElementById('chatbox');
  const userMessageDiv = document.createElement('div');
  userMessageDiv.className = 'message user-message';
  const searchText = document.createElement('strong');
  searchText.innerText = '🔍 Search: ';
  const searchMessage = document.createTextNode(query);
  userMessageDiv.appendChild(searchText);
  userMessageDiv.appendChild(searchMessage);
  chatbox.appendChild(userMessageDiv);
  input.value = '';
  chatbox.scrollTop = chatbox.scrollHeight;

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant-message';
  const loadingText = document.createElement('strong');
  loadingText.innerText = '🤖 AI Search Assistant: ';
  const loadingMessage = document.createTextNode('Searching multiple sources and analyzing results...');
  loadingDiv.appendChild(loadingText);
  loadingDiv.appendChild(loadingMessage);
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
    
    const resultText = document.createElement('strong');
    resultText.innerText = '🤖 AI Search Results:';
    resultDiv.appendChild(resultText);
    
    // Create line breaks for formatting
    const lineBreaks = data.reply.split('\n\n');
    lineBreaks.forEach((paragraph, index) => {
      if (index > 0) {
        resultDiv.appendChild(document.createElement('br'));
        resultDiv.appendChild(document.createElement('br'));
      }
      const paragraphText = document.createTextNode(paragraph.replace(/\n/g, ' '));
      resultDiv.appendChild(paragraphText);
    });
    
    chatbox.appendChild(resultDiv);
    chatbox.scrollTop = chatbox.scrollHeight;

    // Track successful search
    trackSearchAnalytics(query, true);
    
  } catch (error) {
    chatbox.removeChild(loadingDiv);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message assistant-message';
    const errorText = document.createElement('strong');
    errorText.innerText = '❌ Search Error: ';
    const errorMessage = document.createTextNode('Unable to complete search. Please try again or check your connection.');
    errorDiv.appendChild(errorText);
    errorDiv.appendChild(errorMessage);
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
  // Clear existing timer
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  
  // Set new timer - only show suggestions after user stops typing
  searchDebounceTimer = setTimeout(() => {
    // Generate related search suggestions
    const suggestions = generateSearchSuggestions(query);
    if (suggestions.length > 0) {
      // Create hover tooltip instead of chat message
      createSearchTooltip(suggestions);
    }
  }, 800); // Wait 800ms after user stops typing
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
  
  // Create tooltip header
  const header = document.createElement('div');
  header.className = 'tooltip-header';
  const headerText = document.createTextNode('💡 Related searches:');
  header.appendChild(headerText);
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tooltip-close';
  closeBtn.innerText = '×';
  closeBtn.onclick = hideSearchTooltip;
  header.appendChild(closeBtn);
  
  tooltip.appendChild(header);
  
  // Create suggestions container
  const suggestionsContainer = document.createElement('div');
  suggestionsContainer.className = 'tooltip-suggestions';
  
  suggestions.forEach(suggestion => {
    const suggestionBtn = document.createElement('button');
    suggestionBtn.className = 'tooltip-suggestion-btn';
    suggestionBtn.innerText = suggestion;
    suggestionBtn.onclick = () => searchSuggestion(suggestion);
    suggestionsContainer.appendChild(suggestionBtn);
  });
  
  tooltip.appendChild(suggestionsContainer);
  
  // Position tooltip near search input
  const rect = searchInput.getBoundingClientRect();
  tooltip.style.position = 'absolute';
  tooltip.style.top = `${rect.bottom + 5}px`;
  tooltip.style.left = `${rect.left}px`;
  tooltip.style.zIndex = '1000';
  
  document.body.appendChild(tooltip);
  
  // Auto-hide after 3 seconds (much shorter)
  setTimeout(() => {
    if (tooltip.parentNode) {
      tooltip.remove();
    }
  }, 3000);
  
  // Also hide when user starts typing again
  searchInput.addEventListener('input', () => {
    if (tooltip.parentNode) {
      tooltip.remove();
    }
  }, { once: true });
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
      // Clear timer and hide tooltip for short queries
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
      }
      hideSearchTooltip();
    }
  });
  
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      // Clear timer and hide tooltip when searching
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
      }
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
  
  // Clear existing content
  historyDiv.innerHTML = '';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'history-header';
  header.innerText = 'Recent searches:';
  historyDiv.appendChild(header);
  
  // Create history items
  searchHistory.forEach(item => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerText = item;
    historyItem.onclick = () => selectHistoryItem(item);
    historyDiv.appendChild(historyItem);
  });
  
  // Create clear button
  const clearBtn = document.createElement('div');
  clearBtn.className = 'history-clear';
  clearBtn.innerText = 'Clear history';
  clearBtn.onclick = clearSearchHistory;
  historyDiv.appendChild(clearBtn);
  
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
  const uploadText = document.createElement('strong');
  uploadText.innerText = 'You uploaded: ';
  const uploadMessage = document.createTextNode(input.files[0].name);
  userMessageDiv.appendChild(uploadText);
  userMessageDiv.appendChild(uploadMessage);
  chatbox.appendChild(userMessageDiv);
  chatbox.scrollTop = chatbox.scrollHeight;

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant-message';
  const loadingText = document.createElement('strong');
  loadingText.innerText = 'Analyzing file...';
  const loadingMessage = document.createTextNode(' 📁');
  loadingDiv.appendChild(loadingText);
  loadingDiv.appendChild(loadingMessage);
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
    const resultText = document.createElement('strong');
    resultText.innerText = 'File Analysis: ';
    const resultMessage = document.createTextNode(data.reply);
    resultDiv.appendChild(resultText);
    resultDiv.appendChild(resultMessage);
    chatbox.appendChild(resultDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
    input.value = '';
  } catch (error) {
    chatbox.removeChild(loadingDiv);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message assistant-message';
    const errorText = document.createElement('strong');
    errorText.innerText = 'Error: ';
    const errorMessage = document.createTextNode('Upload failed.');
    errorDiv.appendChild(errorText);
    errorDiv.appendChild(errorMessage);
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
  const listeningText = document.createElement('strong');
  listeningText.innerText = 'Listening...';
  const listeningMessage = document.createTextNode(' 🎤 Speak now');
  listeningDiv.appendChild(listeningText);
  listeningDiv.appendChild(listeningMessage);
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
    const errorText = document.createElement('strong');
    errorText.innerText = 'Voice Error: ';
    const errorMessage = document.createTextNode('Could not recognize speech.');
    errorDiv.appendChild(errorText);
    errorDiv.appendChild(errorMessage);
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
    
    // Clear existing content
    trendingContainer.innerHTML = '';
    
    if (data.popular && data.popular.length > 0) {
      data.popular.forEach(item => {
        const trendingBtn = document.createElement('button');
        trendingBtn.className = 'trending-item';
        trendingBtn.onclick = () => searchTrending(item.query);
        
        const queryText = document.createTextNode(item.query);
        trendingBtn.appendChild(queryText);
        
        const countSpan = document.createElement('span');
        countSpan.className = 'trending-count';
        countSpan.innerText = `(${item.count})`;
        trendingBtn.appendChild(countSpan);
        
        trendingContainer.appendChild(trendingBtn);
      });
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'trending-placeholder';
      placeholder.innerText = 'No trending searches yet. Be the first to search!';
      trendingContainer.appendChild(placeholder);
    }
  } catch (error) {
    console.error('Failed to load trending searches:', error);
    const trendingContainer = document.getElementById('trending-searches');
    if (trendingContainer) {
      trendingContainer.innerHTML = '';
      const errorPlaceholder = document.createElement('div');
      errorPlaceholder.className = 'trending-placeholder';
      errorPlaceholder.innerText = 'Unable to load trending searches';
      trendingContainer.appendChild(errorPlaceholder);
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
  
  const chatbox = document.getElementById('chatbox');
  const instructionDiv = document.createElement('div');
  instructionDiv.className = 'message assistant-message';
  
  const instructionContainer = document.createElement('div');
  instructionContainer.style.cssText = 'background: white; padding: 20px; border-radius: 10px; margin: 10px 0;';
  
  const title = document.createElement('h3');
  title.innerText = '📱 Install MyAI App';
  instructionContainer.appendChild(title);
  
  const instructions = document.createElement('div');
  
  if (isIOS) {
    title.innerText = '📱 Install MyAI on iPhone';
    const list = document.createElement('ol');
    
    const steps = [
      'Tap the Share button (square with arrow)',
      'Scroll down and tap "Add to Home Screen"',
      'Tap "Add"',
      'Your app will appear on your home screen!'
    ];
    
    steps.forEach(stepText => {
      const li = document.createElement('li');
      li.innerText = stepText;
      list.appendChild(li);
    });
    
    instructions.appendChild(list);
  } else if (isAndroid) {
    title.innerText = '📱 Install MyAI on Android';
    const list = document.createElement('ol');
    
    const steps = [
      'Tap the three dots menu (⋮)',
      'Tap "Add to Home screen"',
      'Tap "Add"',
      'Your app will appear on your home screen!'
    ];
    
    steps.forEach(stepText => {
      const li = document.createElement('li');
      li.innerText = stepText;
      list.appendChild(li);
    });
    
    instructions.appendChild(list);
  } else {
    const para = document.createElement('p');
    para.innerText = 'To install this app:';
    instructions.appendChild(para);
    
    const list = document.createElement('ul');
    const items = [
      'Chrome/Edge: Look for the install icon in the address bar',
      'Mobile: Use the browser\'s "Add to Home Screen" option'
    ];
    
    items.forEach(itemText => {
      const li = document.createElement('li');
      li.innerText = itemText;
      list.appendChild(li);
    });
    
    instructions.appendChild(list);
  }
  
  instructionContainer.appendChild(instructions);
  instructionDiv.appendChild(instructionContainer);
  chatbox.appendChild(instructionDiv);
  chatbox.scrollTop = chatbox.scrollHeight;
}

function showInstallSuccess() {
  const chatbox = document.getElementById('chatbox');
  const successDiv = document.createElement('div');
  successDiv.className = 'message assistant-message';
  
  const successContainer = document.createElement('div');
  successContainer.style.cssText = 'background: #d4edda; color: #155724; padding: 15px; border-radius: 10px; border: 1px solid #c3e6cb;';
  
  const title = document.createElement('h3');
  title.innerText = '🎉 App Installed Successfully!';
  successContainer.appendChild(title);
  
  const para = document.createElement('p');
  para.innerText = 'MyAI is now installed on your device. You can:';
  successContainer.appendChild(para);
  
  const list = document.createElement('ul');
  const features = [
    'Access it from your home screen',
    'Use it like a native app',
    'Get automatic updates'
  ];
  
  features.forEach(feature => {
    const li = document.createElement('li');
    li.innerText = feature;
    list.appendChild(li);
  });
  
  successContainer.appendChild(list);
  successDiv.appendChild(successContainer);
  chatbox.appendChild(successDiv);
  chatbox.scrollTop = chatbox.scrollHeight;
}
