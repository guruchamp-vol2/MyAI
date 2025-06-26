const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'public/uploads/' });
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

let memory = [];

app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  memory.push({ role: "user", content: userMessage });

  try {
    const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      messages: memory.slice(-10)
    }, {
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const reply = response.data.choices[0].message.content;
    memory.push({ role: "assistant", content: reply });
    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ reply: "Sorry, I couldn't respond." });
  }
});

app.post('/search', async (req, res) => {
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

app.post('/upload', upload.single('file'), (req, res) => {
  const filePath = req.file.path;

  fs.readFile(filePath, 'utf8', async (err, data) => {
    if (err) {
      return res.status(500).json({ reply: "Failed to read file." });
    }

    const cleanText = data.replace(/["\\\\]/g, '');

    try {
      const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages: [
          { role: "user", content: `Summarize the following:\n\n${cleanText}` }
        ]
      }, {
        headers: {
          'Authorization': `Bearer ${TOGETHER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const reply = response.data.choices[0].message.content;
      res.json({ reply });
    } catch (err) {
      console.error('Upload summarization error:', err.message);
      res.status(500).json({ reply: "Failed to summarize the file." });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Assistant running at http://localhost:${PORT}`);
});
