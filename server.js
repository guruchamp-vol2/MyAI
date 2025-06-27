const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const FormData = require('form-data');
const Tesseract = require('tesseract.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecurekey';
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY || '';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const usersFile = path.join(__dirname, 'users.json');
if (!fs.existsSync(usersFile) || !fs.readFileSync(usersFile, 'utf8').trim()) {
  fs.writeFileSync(usersFile, JSON.stringify([]));
}

// In-memory chat history (resets on restart)
const chatMemory = {};

const upload = multer({ dest: 'public/uploads/' });

function readUsers() {
  try {
    const data = fs.readFileSync(usersFile, 'utf8');
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (e) {
    fs.writeFileSync(usersFile, JSON.stringify([]));
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
    chatMemory[username] = [];
  }

  // Only add system prompt if user asks who made you
  let context = chatMemory[username].slice(-9).filter(m => m && m.content && m.content.trim());
  if (/who (made|created|coded|built) you|who is your creator|who is your author/i.test(message)) {
    context = [{ role: 'system', content: "If anyone asks who created you, always reply with exactly: 'Dhruv Bajaj coded me.' Do not say anything else." }, ...context];
  }
  chatMemory[username].push({ role: 'user', content: message });
  context.push({ role: 'user', content: message });
  context = context.filter(m => m && m.content && m.content.trim());
  // Defensive fix: ensure context is always a valid, non-empty array
  if (!Array.isArray(context) || context.length === 0 || !context.every(m => m && m.role && m.content && m.content.trim())) {
    context = [{ role: 'user', content: message }];
  }
  // Debug log for Together API context
  console.log('Together API context:', JSON.stringify(context, null, 2));

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
  const ext = path.extname(req.file.originalname).toLowerCase();
  // Debug log for file extension and original filename
  console.log('File upload:', { originalname: req.file.originalname, ext });

  // Check file existence and size
  try {
    const stats = fs.statSync(filePath);
    console.log('File stats:', stats);
    if (stats.size === 0) {
      return res.status(400).json({ reply: "Uploaded file is empty." });
    }
    if (stats.size > 1024 * 1024) { // 1MB limit for free OCR.space
      return res.status(400).json({ reply: "File is too large for this AI (max 1MB)." });
    }
  } catch (e) {
    console.error('File stat/read error:', e);
    return res.status(400).json({ reply: "Uploaded file could not be read." });
  }

  async function summarizeText(text, userMessage) {
    let messages = [];
    if (/who (made|created|coded|built) you|who is your creator|who is your author/i.test(userMessage)) {
      messages.push({ role: "system", content: "If anyone asks who created you, always reply with exactly: 'Dhruv Bajaj coded me.' Do not say anything else." });
    }
    messages.push({ role: "user", content: `Summarize the following:\n\n${text}` });
    try {
      const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages,
      }, {
        headers: {
          'Authorization': `Bearer ${TOGETHER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data.choices[0]?.message?.content || "No summary available.";
    } catch (err) {
      console.error('File summary error:', err.response?.data || err.message || err);
      return "Failed to summarize the file.";
    }
  }

  if ([".txt", ".md", ".csv"].includes(ext)) {
    fs.readFile(filePath, 'utf8', async (err, data) => {
      if (err) return res.status(500).json({ reply: "Failed to read file." });
      const cleanText = data.replace(/["\\]/g, '');
      const summary = await summarizeText(cleanText, 'summarize');
      res.json({ reply: summary });
    });
    return;
  }

  if ([".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".webp"].includes(ext)) {
    console.log('Using Tesseract.js for OCR...');
    try {
      const result = await Tesseract.recognize(filePath, 'eng', {
        logger: m => console.log('Tesseract progress:', m)
      });
      
      console.log('Tesseract OCR completed');
      const parsed = result.data.text || '';
      
      if (!parsed.trim()) {
        return res.json({ reply: "No readable text found in the image." });
      }
      
      console.log('Extracted text length:', parsed.length);
      const summary = await summarizeText(parsed, 'summarize');
      res.json({ reply: summary });
    } catch (err) {
      console.error('Tesseract OCR error:', err);
      res.status(500).json({ reply: "Failed to extract text from image: " + err.message });
    }
    return;
  }

  res.json({ reply: "Sorry, this file type is not supported for analysis. Please upload a text or image file." });
});

app.listen(PORT, () => {
  console.log(`✅ Server ready at http://localhost:${PORT}`);
});
