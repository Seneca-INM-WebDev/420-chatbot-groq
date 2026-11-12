const messages = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const form = document.getElementById('input-form');

function addMessage(text, isUser) {
  const article = document.createElement('article');
  article.className = isUser ? 'user' : 'bot';
  article.textContent = text;
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
}

async function sendMessage(text) {
  addMessage(text, true);
  const botMessage = addMessage('Thinking...', false);

  try {
    const response = await fetch('http://localhost:3000/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    const data = await response.json();
    if (!response.ok) {
      botMessage.textContent = typeof data.error === 'string' && data.error.trim()
        ? data.error
        : 'Error: The server could not process your message.';
      return;
    }
    if (typeof data.reply !== 'string' || !data.reply.trim()) {
      throw new Error('Server returned an invalid reply.');
    }
    botMessage.textContent = data.reply;
  } catch (error) {
    console.error('Chat request failed:', error);
    botMessage.textContent = 'Error: Could not connect to server or read its response.';
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (text) {
    sendMessage(text);
    userInput.value = '';
  }
});