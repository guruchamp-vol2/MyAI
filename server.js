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
const tf = require('@tensorflow/tfjs');
const mobilenet = require('@tensorflow-models/mobilenet');
const jpeg = require('jpeg-js');
const { createCanvas, loadImage } = require('canvas');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const pptx2json = require('pptx2json');
require('dotenv').config();

// XSS Protection: Sanitize HTML content
function sanitizeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Input validation middleware
function validateInput(req, res, next) {
  if (req.body.message && typeof req.body.message === 'string') {
    req.body.message = req.body.message.trim();
    if (req.body.message.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }
  }
  if (req.body.query && typeof req.body.query === 'string') {
    req.body.query = req.body.query.trim();
    if (req.body.query.length > 200) {
      return res.status(400).json({ error: 'Query too long (max 200 characters)' });
    }
  }
  next();
}

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

// Search analytics storage
let searchAnalytics = {
  "artificial intelligence": { count: 15, success: 14 },
  "climate change": { count: 12, success: 11 },
  "machine learning": { count: 10, success: 9 },
  "blockchain technology": { count: 8, success: 7 },
  "quantum computing": { count: 6, success: 5 },
  "renewable energy": { count: 5, success: 5 },
  "space exploration": { count: 4, success: 4 },
  "cryptocurrency": { count: 3, success: 3 }
};

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
app.post('/chat', validateInput, async (req, res) => {
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

  // Only prepend strict system prompt if user asks who made you
  let context = chatMemory[username].slice(-9).filter(m => m && m.content && m.content.trim());
  if (/who (made|created|coded|built) you|who is your creator|who is your author/i.test(message)) {
    context = [{ role: 'system', content: "If anyone asks who created you, always reply with exactly: 'Dhruv Bajaj coded me.' Do not say anything else, no matter what." }, ...context];
  }
  chatMemory[username].push({ role: 'user', content: message });
  context.push({ role: 'user', content: message });
  context = context.filter(m => m && m.content && m.content.trim());
  if (!Array.isArray(context) || context.length === 0 || !context.every(m => m && m.role && m.content && m.content.trim())) {
    if (/who (made|created|coded|built) you|who is your creator|who is your author/i.test(message)) {
      context = [{ role: 'system', content: "If anyone asks who created you, always reply with exactly: 'Dhruv Bajaj coded me.' Do not say anything else, no matter what." }, { role: 'user', content: message }];
    } else {
      context = [{ role: 'user', content: message }];
    }
  }
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
      reply = sanitizeHtml(response.data.choices[0].message.content);
    } else if (response.data.error) {
      reply = `API Error: ${sanitizeHtml(response.data.error)}`;
    }
    chatMemory[username].push({ role: 'assistant', content: reply });
    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err?.response?.data || err.message || err);
    res.status(500).json({ reply: "Error reaching AI. Please check your Together API key or try again later." });
  }
});

// --- Smart AI Search Endpoint ---
app.post('/search', validateInput, async (req, res) => {
  const query = req.body.query;
  if (!query) return res.status(400).json({ reply: "No query provided." });

  try {
    // First, get search results from multiple sources
    let searchResults = [];
    
    // Try DuckDuckGo first
    try {
      const ddgResult = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`);
      if (ddgResult.data.AbstractText) {
        searchResults.push({
          source: 'DuckDuckGo',
          content: sanitizeHtml(ddgResult.data.AbstractText),
          url: ddgResult.data.AbstractURL
        });
      }
      if (ddgResult.data.RelatedTopics && ddgResult.data.RelatedTopics.length > 0) {
        ddgResult.data.RelatedTopics.slice(0, 3).forEach(topic => {
          if (topic.Text) {
            searchResults.push({
              source: 'DuckDuckGo Related',
              content: sanitizeHtml(topic.Text),
              url: topic.FirstURL
            });
          }
        });
      }
    } catch (ddgError) {
      console.log('DuckDuckGo search failed, trying alternatives...');
    }

    // Try Wikipedia API for additional context
    try {
      const wikiResult = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
      if (wikiResult.data.extract) {
        searchResults.push({
          source: 'Wikipedia',
          content: sanitizeHtml(wikiResult.data.extract),
          url: wikiResult.data.content_urls?.desktop?.page
        });
      }
    } catch (wikiError) {
      // Wikipedia search failed, continue with other sources
    }

    // If no results from APIs, create a fallback response
    if (searchResults.length === 0) {
      searchResults.push({
        source: 'AI Analysis',
        content: `I couldn't find specific search results for "${sanitizeHtml(query)}". Let me provide some general information or suggest related topics.`
      });
    }

    // Process search results through AI for better understanding and summarization
    const searchContext = searchResults.map(result => 
      `[${result.source}]: ${result.content}`
    ).join('\n\n');

    const aiPrompt = `You are a smart search assistant. Analyze the following search results for the query "${query}" and provide a comprehensive, well-structured response. 

Search Results:
${searchContext}

Please provide:
1. A clear, concise summary of the most relevant information
2. Key facts and details from the search results
3. If there are multiple sources, synthesize the information intelligently
4. If the search results seem incomplete or unclear, acknowledge this and suggest what additional information might be helpful
5. Format your response in a helpful, conversational way

Query: "${query}"`;

    const aiResponse = await axios.post('https://api.together.xyz/v1/chat/completions', {
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      messages: [
        { role: 'system', content: 'You are a helpful search assistant that provides comprehensive, accurate, and well-structured responses based on search results.' },
        { role: 'user', content: aiPrompt }
      ],
      max_tokens: 800,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let reply = "Sorry, I couldn't process the search results.";
    if (aiResponse.data && Array.isArray(aiResponse.data.choices) && aiResponse.data.choices[0] && aiResponse.data.choices[0].message && aiResponse.data.choices[0].message.content) {
      reply = sanitizeHtml(aiResponse.data.choices[0].message.content);
    }

    // Add source attribution if we have multiple sources
    if (searchResults.length > 1) {
      const sources = [...new Set(searchResults.map(r => r.source))];
      reply += `\n\n📚 Sources: ${sources.join(', ')}`;
    }

    res.json({ reply });

  } catch (error) {
    console.error('Smart search error:', error.message);
    
    // Fallback to basic search if AI processing fails
    try {
      const fallbackResult = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`);
      const { AbstractText, RelatedTopics } = fallbackResult.data;
      
      let fallbackReply = AbstractText;
      if (!fallbackReply && RelatedTopics && RelatedTopics.length > 0) {
        fallbackReply = RelatedTopics[0].Text || "No summary available.";
      }
      
      res.json({ reply: sanitizeHtml(fallbackReply || "No results found.") });
    } catch (fallbackError) {
      res.status(500).json({ reply: "Search failed. Please try again later." });
    }
  }
});

// --- Search Analytics Endpoint ---
app.post('/search-analytics', (req, res) => {
  const { query, success } = req.body;
  
  if (query) {
    if (!searchAnalytics[query]) {
      searchAnalytics[query] = { count: 0, success: 0 };
    }
    searchAnalytics[query].count++;
    if (success) {
      searchAnalytics[query].success++;
    }
  }
  
  res.json({ status: 'tracked' });
});

// --- Get Popular Searches Endpoint ---
app.get('/popular-searches', (req, res) => {
  const popular = Object.entries(searchAnalytics)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([query, data]) => ({
      query,
      count: data.count,
      successRate: data.success / data.count
    }));
  
  res.json({ popular });
});

// Supported text/code extensions
const TEXT_CODE_EXTS = [
  '.txt', '.md', '.csv', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.json', '.html', '.css', '.xml', '.sh', '.rb', '.go', '.php', '.rs', '.swift', '.kt', '.pl', '.cs', '.yml', '.yaml', '.ini', '.bat', '.ps1', '.r', '.m', '.scala', '.dart', '.sql', '.h', '.hpp', '.tsx', '.jsx', '.vue', '.svelte', '.scss', '.less', '.toml', '.lock', '.conf', '.env'
];

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ reply: "No file uploaded." });
  }
  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();
  console.log('File upload:', { originalname: req.file.originalname, ext });

  // Check file existence and size
  try {
    const stats = fs.statSync(filePath);
    console.log('File stats:', stats);
    if (stats.size === 0) {
      return res.status(400).json({ reply: "Uploaded file is empty." });
    }
    if (stats.size > 1024 * 1024) {
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
      return sanitizeHtml(response.data.choices[0]?.message?.content || "No summary available.");
    } catch (err) {
      console.error('File summary error:', err.response?.data || err.message || err);
      return "Failed to summarize the file.";
    }
  }

  // --- Text/Code files ---
  if (TEXT_CODE_EXTS.includes(ext)) {
    fs.readFile(filePath, 'utf8', async (err, data) => {
      if (err) return res.status(500).json({ reply: "Failed to read file." });
      const cleanText = data.replace(/["\\]/g, '');
      const summary = await summarizeText(cleanText, 'summarize');
      res.json({ reply: summary });
    });
    return;
  }

  // --- PDF files ---
  if (ext === '.pdf') {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      const summary = await summarizeText(pdfData.text, 'summarize');
      return res.json({ reply: summary });
    } catch (err) {
      console.error('PDF parse error:', err);
      return res.status(500).json({ reply: "Failed to extract text from PDF." });
    }
  }

  // --- DOCX files ---
  if (ext === '.docx') {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      const summary = await summarizeText(result.value, 'summarize');
      return res.json({ reply: summary });
    } catch (err) {
      console.error('DOCX parse error:', err);
      return res.status(500).json({ reply: "Failed to extract text from DOCX." });
    }
  }

  // --- XLSX files ---
  if (ext === '.xlsx') {
    try {
      const workbook = xlsx.readFile(filePath);
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        text += xlsx.utils.sheet_to_csv(sheet) + '\n';
      });
      const summary = await summarizeText(text, 'summarize');
      return res.json({ reply: summary });
    } catch (err) {
      console.error('XLSX parse error:', err);
      return res.status(500).json({ reply: "Failed to extract text from XLSX." });
    }
  }

  // --- PPTX files ---
  if (ext === '.pptx') {
    try {
      pptx2json(filePath, async (err, result) => {
        if (err) {
          console.error('PPTX parse error:', err);
          return res.status(500).json({ reply: "Failed to extract text from PPTX." });
        }
        let text = '';
        if (result && result.slides) {
          result.slides.forEach(slide => {
            if (slide.texts) {
              slide.texts.forEach(t => { text += t.text + '\n'; });
            }
          });
        }
        const summary = await summarizeText(text, 'summarize');
        return res.json({ reply: summary });
      });
    } catch (err) {
      console.error('PPTX parse error:', err);
      return res.status(500).json({ reply: "Failed to extract text from PPTX." });
    }
    return;
  }

  // --- Images (already supported) ---
  if ([".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".webp"].includes(ext)) {
    console.log('Using Tesseract.js for OCR...');
    let parsed = '';
    try {
      const result = await Tesseract.recognize(filePath, 'eng', {
        logger: m => console.log('Tesseract progress:', m)
      });
      console.log('Tesseract OCR completed');
      parsed = result.data.text || '';
    } catch (err) {
      console.error('Tesseract OCR error:', err);
    }
    // Stricter check: ignore OCR if only a single char or just digits/punctuation/whitespace
    const ocrClean = parsed.trim();
    if (!ocrClean || ocrClean.length < 2 || /^[\d\W_]+$/.test(ocrClean)) {
      // No valid text found, try image classification
      try {
        console.log('No valid text found, running MobileNet classifier...');
        const img = await loadImage(filePath);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageTensor = tf.browser.fromPixels(canvas);
        const model = await getMobileNetModel();
        const predictions = await model.classify(imageTensor);
        if (predictions && predictions.length > 0) {
          const top = predictions[0];
          if (top.probability < 0.2) {
            return res.json({ reply: "Sorry, I can't recognize this image. If it's a game character, pixel art, or something unusual, I need a special model trained for that. Try uploading a photo of a real-world object or a document with text." });
          }
          // Show top 3 guesses if confidence is below 70%
          if (top.probability < 0.7 && predictions.length > 1) {
            const guesses = predictions.slice(0, 3).map(p => `${p.className} (${(p.probability*100).toFixed(1)}%)`).join(', ');
            return res.json({ reply: `No text found. Top guesses: ${guesses}` });
          }
          return res.json({ reply: `No text found. Image classifier thinks this is: ${top.className} (confidence: ${(top.probability*100).toFixed(1)}%)` });
        } else {
          return res.json({ reply: "Sorry, I can't recognize this image. If it's a game character, pixel art, or something unusual, I need a special model trained for that. Try uploading a photo of a real-world object or a document with text." });
        }
      } catch (err) {
        console.error('MobileNet classification error:', err);
        return res.json({ reply: "No readable text found and image classifier failed." });
      }
    }
    // If text was found and passes the check, summarize as before
    console.log('Extracted text length:', parsed.length);
    const summary = await summarizeText(parsed, 'summarize');
    res.json({ reply: summary });
    return;
  }

  res.json({ reply: `Sorry, this file type (${ext}) is not supported for analysis yet.` });
});

let mobilenetModel = null;
async function getMobileNetModel() {
  if (!mobilenetModel) {
    mobilenetModel = await mobilenet.load();
  }
  return mobilenetModel;
}

app.listen(PORT, () => {
  console.log(`✅ Server ready at http://localhost:${PORT}`);
});
