const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecurekey';
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY || ''; // Optional

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const usersFile = path.join(__dirname, 'users.json');
// Always initialize users.json if missing or empty
if (!fs.existsSync(usersFile) || !fs.readFileSync(usersFile, 'utf8').trim()) {
  fs.writeFileSync(usersFile, JSON.stringify([]));
}

// Memory-based chat history (clears on server restart)
const chatMemory = {};

// Upload middleware
const upload = multer({ dest: 'public/uploads/' });

// Load or update users
function readUsers() {
  try {
    const data = fs.readFileSync(usersFile, 'utf8');
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (e) {
    // If file is empty or invalid, reset to empty array
    writeUsers([]);
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}
// --- Register ---
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }
  const users = readUsers();
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  users.push({ username, password: hashed });
  writeUsers(users);
  res.json({ message: 'Registered' });
});

// --- Login ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username }, JWT_SECRET);
  res.json({ token });
});

// --- Chat Endpoint ---
app.post('/chat', async (req, res) => {
  const message = req.body.message;
  let username = 'guest';
  let isGuest = true;

  // Try to get user from token if present
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const user = jwt.verify(token, JWT_SECRET);
      username = user.username;
      isGuest = false;
    } catch {
      // Invalid token, treat as guest
    }
  }

  if (!chatMemory[username]) {
    chatMemory[username] = [
      { role: 'system', content: "You are a helpful AI assistant. If anyone asks who created you, say 'Dhruv Bajaj coded me.'" }
    ];
  }

  chatMemory[username].push({ role: 'user', content: message });
  const context = chatMemory[username].slice(-10);

  try {
    const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      messages: context
    }, {
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    // Log the full response for debugging
    console.log('Together API response:', JSON.stringify(response.data, null, 2));
    let reply = "Sorry, no response.";
    if (response.data && Array.isArray(response.data.choices) && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content) {
      reply = response.data.choices[0].message.content;
    } else if (response.data.error) {
      reply = `API Error: ${response.data.error}`;
    }
    chatMemory[username].push({ role: 'assistant', content: reply });
    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err?.response?.data || err.message || err);
    res.status(500).json({ reply: "Error reaching AI. Please check your Together API key or try again later." });
  }
});

// --- Search Endpoint ---
app.post('/search', async (req, res) => {
  const query = req.body.query;
  if (!query) return res.status(400).json({ reply: "No query provided." });

  try {
    const result = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`);
    const { AbstractText, RelatedTopics } = result.data;

    let reply = AbstractText;
    if (!reply && RelatedTopics && RelatedTopics.length > 0) {
      reply = RelatedTopics[0].Text || "No summary available.";
    }

    res.json({ reply: reply || "No results found." });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ reply: "Search failed." });
  }
});

// --- File Upload Endpoint ---
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ reply: "No file uploaded." });
  }
  const filePath = req.file.path;
  const allowedTypes = ['.txt', '.md', '.csv'];

  if (!allowedTypes.some(ext => req.file.originalname.endsWith(ext))) {
    fs.unlinkSync(filePath);
    return res.status(400).json({ reply: "Unsupported file type. Use .txt, .csv, or .md" });
  }

  fs.readFile(filePath, 'utf8', async (err, data) => {
    if (err) {
      return res.status(500).json({ reply: "Failed to read file." });
    }

    const cleanText = data.replace(/["\\]/g, '');
    try {
      const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages: [
          { role: "system", content: "You are a helpful AI assistant. If anyone asks who created you, say 'Dhruv Bajaj coded me.'" },
          { role: "user", content: `Summarize the following:\n\n${cleanText}` }
        ],
      }, {
        headers: {
          'Authorization': `Bearer ${TOGETHER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const reply = response.data.choices[0]?.message?.content || "No summary available.";
      res.json({ reply });
    } catch (err) {
      console.error('File summary error:', err.response?.data || err.message || err);
      res.status(500).json({ reply: "Failed to summarize the file." });
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server ready at http://localhost:${PORT}`);
});
