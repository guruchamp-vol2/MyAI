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
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, JSON.stringify([]));

// Memory-based chat history (clears on server restart)
const chatMemory = {};

// Upload middleware
const upload = multer({ dest: 'public/uploads/' });

// Load or update users
function readUsers() {
  return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
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

// --- Auth Middleware ---
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Chat Endpoint ---
app.post('/chat', auth, async (req, res) => {
  const message = req.body.message;
  const username = req.user.username;

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

app.listen(PORT, () => {
  console.log(`✅ Server ready at http://localhost:${PORT}`);
});
