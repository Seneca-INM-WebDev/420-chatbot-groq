const messages = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const form = document.getElementById('input-form');

function addMessage(text, isUser) {
  const article = document.createElement('article');
  article.className = isUser ? 'user' : 'bot';
  article.textContent = text;
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
}

async function sendMessage(text) {
  addMessage(text, true);
  addMessage('Thinking...', false);

  try {
    const response = await fetch('http://localhost:3000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    const data = await response.json();
    messages.lastChild.textContent = data.reply;
  } catch (error) {
    messages.lastChild.textContent = 'Error: Could not connect to server';
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