import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

function createChat(fetch) {
  const messages = {
    children: [],
    appendChild(child) {
      this.children.push(child);
    }
  };
  const elements = {
    messages,
    userInput: { value: '' },
    'input-form': { addEventListener() {} }
  };
  const context = {
    document: {
      getElementById: (id) => elements[id],
      createElement: () => ({})
    },
    fetch,
    console: { error() {} }
  };
  runInNewContext(source, context);
  return { messages, sendMessage: context.sendMessage };
}

test('displays successful replies and server errors in bot bubbles', async () => {
  for (const [response, expected] of [
    [{ ok: true, json: async () => ({ reply: 'Hello!' }) }, 'Hello!'],
    [{ ok: false, json: async () => ({ error: 'Rate limit reached. Please try again shortly.' }) }, 'Rate limit reached. Please try again shortly.'],
    [{ ok: false, json: async () => ({}) }, 'Error: The server could not process your message.']
  ]) {
    const { messages, sendMessage } = createChat(async () => response);
    await sendMessage('Hi');
    assert.equal(messages.children[0].className, 'user');
    assert.equal(messages.children[1].className, 'bot');
    assert.equal(messages.children[1].textContent, expected);
  }
});

test('displays connection and invalid response errors in bot bubbles', async () => {
  for (const fetch of [
    async () => { throw new Error('Network error'); },
    async () => ({ ok: true, json: async () => ({}) }),
    async () => ({ ok: false, json: async () => { throw new Error('Invalid JSON'); } })
  ]) {
    const { messages, sendMessage } = createChat(fetch);
    await sendMessage('Hi');
    assert.equal(messages.children[1].className, 'bot');
    assert.equal(messages.children[1].textContent, 'Error: Could not connect to server or read its response.');
  }
});

test('updates the correct bubble when responses arrive out of order', async () => {
  const pending = [];
  const { messages, sendMessage } = createChat(() => new Promise((resolve) => pending.push(resolve)));
  const first = sendMessage('First');
  const second = sendMessage('Second');
  pending[1]({ ok: false, json: async () => ({ error: 'Second failed' }) });
  await second;
  pending[0]({ ok: true, json: async () => ({ reply: 'First reply' }) });
  await first;
  assert.deepEqual(messages.children.map((message) => message.textContent), [
    'First', 'First reply', 'Second', 'Second failed'
  ]);
});
