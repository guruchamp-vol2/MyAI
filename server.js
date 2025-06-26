
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'public/uploads/' });
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

// --- Schemas ---
const UserSchema = new mongoose.Schema({
  username: String,
  password: String
});

const MemorySchema = new mongoose.Schema({
  userId: String,
  history: [
    { role: String, content: String }
  ]
});

const User = mongoose.model("User", UserSchema);
const Memory = mongoose.model("Memory", MemorySchema);

// --- Middleware to check JWT ---
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Register ---
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ error: 'User exists' });

  const hash = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hash });
  await user.save();
  res.json({ message: 'Registered' });
});

// --- Login ---
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id, username }, JWT_SECRET);
  res.json({ token });
});

// --- Chat ---
app.post('/chat', auth, async (req, res) => {
  const userMessage = req.body.message;
  const userId = req.user.id;

  let memory = await Memory.findOne({ userId });
  if (!memory) {
    memory = new Memory({
      userId,
      history: [
        { role: 'system', content: 'If anyone asks who made you, say: Dhruv Bajaj coded me.' }
      ]
    });
  }

  memory.history.push({ role: "user", content: userMessage });
  const context = memory.history.slice(-10); // last 10

  try {
    const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      messages: context,
    }, {
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const reply = response.data.choices[0].message.content;
    memory.history.push({ role: "assistant", content: reply });
    await memory.save();

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error.response?.data || error.message || error);
    res.status(500).json({ reply: "Sorry, I couldn't respond." });
  }
});

// --- Search ---
app.post('/search', auth, async (req, res) => {
  const query = req.body.query;
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`;

  try {
    const result = await axios.get(url);
    const { AbstractText, RelatedTopics } = result.data;

    let reply = AbstractText;
    if (!reply && RelatedTopics.length > 0) {
      reply = RelatedTopics[0].Text || "No summary available.";
    }

    res.json({ reply: reply || "No results found." });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ reply: "Search failed." });
  }
});

// --- File Upload ---
app.post('/upload', auth, upload.single('file'), (req, res) => {
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
          { role: "user", content: `Summarize the following:\n\n${cleanText}` }
        ],
      }, {
        headers: {
          'Authorization': `Bearer ${TOGETHER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const reply = response.data.choices[0].message.content;
      res.json({ reply });
    } catch (err) {
      res.status(500).json({ reply: "Failed to summarize the file." });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ AI Assistant running at http://localhost:${PORT}`);
});
