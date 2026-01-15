const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Store conversation context (simple version)
const conversations = new Map();

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default', context } = req.body;
  
  try {
    // Get conversation history
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const history = conversations.get(sessionId);
    
    // Prepare prompt with context
    const prompt = `You are a helpful assistant for a blogging website.
    ${context ? `The user is on page: ${context}` : ''}
    
    Previous conversation:
    ${history.slice(-5).map(h => `${h.role}: ${h.content}`).join('\n')}
    
    Current question: ${message}
    
    Answer helpfully and concisely:`;
    
    // Call Ollama
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2',
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        max_tokens: 500
      }
    });
    
    // Save to history
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: response.data.response });
    
    // Keep only last 10 messages
    if (history.length > 10) conversations.set(sessionId, history.slice(-10));
    
    res.json({ 
      reply: response.data.response,
      sessionId: sessionId 
    });
    
  } catch (error) {
    console.error('Ollama error:', error.message);
    res.status(500).json({ 
      error: 'AI service unavailable',
      reply: 'I apologize, but I\'m having trouble connecting right now. Please try again later.'
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await axios.get('http://localhost:11434/api/tags');
    res.json({ status: 'Ollama is running' });
  } catch (error) {
    res.status(500).json({ status: 'Ollama is not available' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Chat backend running on port ${PORT}`);
});
