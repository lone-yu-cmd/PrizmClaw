const STORAGE_KEY = 'prizmclaw-web-session';

const state = {
  baseUrl: '',
  sessionId: '',
  busy: false,
  eventSource: null,
  streamingMessageBody: null,
  streamedText: '',
  availableCommands: [],
  commandDropdownVisible: false
};

const els = {
  status: document.getElementById('status'),
  baseUrlInput: document.getElementById('baseUrlInput'),
  sessionIdInput: document.getElementById('sessionIdInput'),
  chatMessages: document.getElementById('chatMessages'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  charCounter: document.getElementById('charCounter'),
  sendChatBtn: document.getElementById('sendChatBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  takeScreenshotBtn: document.getElementById('takeScreenshotBtn'),
  screenshotImage: document.getElementById('screenshotImage'),
  screenshotMeta: document.getElementById('screenshotMeta'),
  execForm: document.getElementById('execForm'),
  execInput: document.getElementById('execInput'),
  runExecBtn: document.getElementById('runExecBtn'),
  exitCodeOutput: document.getElementById('exitCodeOutput'),
  stdoutOutput: document.getElementById('stdoutOutput'),
  stderrOutput: document.getElementById('stderrOutput')
};

function randomSessionId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `web-${Date.now()}-${rand}`;
}

function setStatus(text, state) {
  els.status.textContent = text;
  els.status.classList.remove('connected', 'error');
  if (state) els.status.classList.add(state);
}

const CHAR_LIMIT = 8000;
const CHAR_WARN_THRESHOLD = CHAR_LIMIT * 0.8;

function updateCharCounter() {
  const len = els.chatInput.value.length;
  els.charCounter.textContent = len;
  els.charCounter.parentElement.classList.toggle('warning', len >= CHAR_WARN_THRESHOLD);
}

function setBusy(busy, text) {
  state.busy = busy;
  els.sendChatBtn.disabled = busy;
  els.takeScreenshotBtn.disabled = busy;
  els.runExecBtn.disabled = busy;
  setStatus(text);
}

function saveSessionConfig() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      baseUrl: state.baseUrl,
      sessionId: state.sessionId
    })
  );
}

function loadSessionConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (typeof parsed.baseUrl === 'string') {
      state.baseUrl = parsed.baseUrl;
    }
    if (typeof parsed.sessionId === 'string' && parsed.sessionId.trim()) {
      state.sessionId = parsed.sessionId;
    }
  } catch {
    // ignore
  }
}

function createMessageElement(role, text, isError = false, isHtml = false) {
  const item = document.createElement('div');
  item.className = `message ${role} ${isError ? 'error' : ''}`.trim();

  const roleEl = document.createElement('span');
  roleEl.className = 'role';
  roleEl.textContent = role === 'user' ? '你' : role === 'assistant' ? '助手' : '系统';

  const body = document.createElement('div');
  body.className = 'body';
  if (isHtml) {
    body.innerHTML = text;
  } else {
    body.textContent = text;
  }

  item.append(roleEl, body);
  return { item, body };
}

function appendMessage(role, text, isError = false, isHtml = false) {
  const node = createMessageElement(role, text, isError, isHtml);
  els.chatMessages.appendChild(node.item);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  return node;
}

function getApiUrl(path) {
  const base = state.baseUrl.trim();
  if (!base) {
    return path;
  }
  return `${base.replace(/\/$/, '')}${path}`;
}

function getEventsUrl() {
  const query = new URLSearchParams({
    channel: 'web',
    sessionId: state.sessionId
  }).toString();

  return `${getApiUrl('/api/events')}?${query}`;
}

function closeRealtime() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
}

// ── Command Autocomplete ──────────────────────────────────────────────────────

let commandDropdown = null;

function createCommandDropdown() {
  commandDropdown = document.createElement('div');
  commandDropdown.className = 'command-dropdown';
  commandDropdown.style.cssText = 'position:absolute;background:#1e1e2e;border:1px solid #444;border-radius:4px;max-height:200px;overflow-y:auto;z-index:100;width:100%;box-sizing:border-box;display:none;';
  els.chatForm.style.position = 'relative';
  els.chatForm.appendChild(commandDropdown);
}

function showCommandDropdown(commands) {
  if (!commandDropdown) createCommandDropdown();
  commandDropdown.innerHTML = '';

  if (commands.length === 0) {
    commandDropdown.style.display = 'none';
    state.commandDropdownVisible = false;
    return;
  }

  commands.forEach((cmd) => {
    const item = document.createElement('div');
    item.style.cssText = 'padding:6px 10px;cursor:pointer;font-family:monospace;font-size:13px;';
    item.innerHTML = `<strong>/${cmd.name}</strong> — ${cmd.description}`;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      els.chatInput.value = `/${cmd.name} `;
      hideCommandDropdown();
      els.chatInput.focus();
    });
    item.addEventListener('mouseover', () => { item.style.background = '#313244'; });
    item.addEventListener('mouseout', () => { item.style.background = ''; });
    commandDropdown.appendChild(item);
  });

  commandDropdown.style.display = 'block';
  state.commandDropdownVisible = true;
}

function hideCommandDropdown() {
  if (commandDropdown) commandDropdown.style.display = 'none';
  state.commandDropdownVisible = false;
}

function filterCommands(prefix) {
  const query = prefix.slice(1).toLowerCase(); // Remove leading /
  return state.availableCommands.filter((cmd) => {
    return cmd.name.startsWith(query) || (cmd.aliases || []).some((a) => a.startsWith(query));
  });
}

async function loadAvailableCommands() {
  try {
    const response = await fetch(getApiUrl('/api/commands'));
    const data = await response.json();
    if (data.ok && Array.isArray(data.commands)) {
      state.availableCommands = data.commands;
    }
  } catch {
    // Non-critical — autocomplete just won't work
  }
}

function connectRealtime() {
  closeRealtime();

  if (typeof EventSource === 'undefined') {
    setStatus('当前浏览器不支持实时推送（EventSource）');
    return;
  }

  const es = new EventSource(getEventsUrl());
  state.eventSource = es;

  es.addEventListener('connected', () => {
    setStatus('实时通道已连接', 'connected');
  });

  es.addEventListener('status', (event) => {
    const payload = JSON.parse(event.data);
    if (payload.stage === 'running') {
      setStatus('助手处理中...');
      return;
    }

    if (payload.stage === 'accepted') {
      setStatus('已接收请求');
      return;
    }

    setStatus('实时通道在线', 'connected');
  });

  es.addEventListener('assistant_chunk', (event) => {
    const payload = JSON.parse(event.data);

    if (!state.streamingMessageBody) {
      const node = appendMessage('assistant', '');
      state.streamingMessageBody = node.body;
      state.streamedText = '';
    }

    state.streamedText += payload.text ?? '';
    state.streamingMessageBody.textContent = state.streamedText;
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  });

  es.addEventListener('assistant_done', (event) => {
    const payload = JSON.parse(event.data);
    if (state.streamingMessageBody) {
      state.streamingMessageBody.textContent = payload.reply ?? state.streamedText;
    } else if (payload.isCommand) {
      // Command result came via SSE (not via HTTP response) — render as HTML
      appendMessage('assistant', payload.reply || '(命令已执行)', false, true);
    }
    setStatus('就绪');
  });

  es.onerror = () => {
    setStatus('实时通道重连中...', 'error');
  };
}

async function callJson(path, payload) {
  const response = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `请求失败: ${response.status}`);
  }
  return data;
}

function normalizeZeroHost() {
  if (window.location.hostname !== '0.0.0.0') {
    return false;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.hostname = '127.0.0.1';
  window.location.replace(nextUrl.toString());
  return true;
}

function init() {
  if (normalizeZeroHost()) {
    return;
  }

  loadSessionConfig();

  if (!state.sessionId) {
    state.sessionId = randomSessionId();
  }

  els.baseUrlInput.value = state.baseUrl;
  els.sessionIdInput.value = state.sessionId;

  appendMessage('system', '欢迎使用 PrizmClaw。你可以聊天、抓取截图、执行受控系统命令。输入 / 查看可用命令。');
  connectRealtime();
  loadAvailableCommands();
}

els.baseUrlInput.addEventListener('change', () => {
  state.baseUrl = els.baseUrlInput.value.trim();
  saveSessionConfig();
  connectRealtime();
});

els.sessionIdInput.addEventListener('change', () => {
  const value = els.sessionIdInput.value.trim();
  state.sessionId = value || randomSessionId();
  els.sessionIdInput.value = state.sessionId;
  saveSessionConfig();
  connectRealtime();
});

els.clearChatBtn.addEventListener('click', () => {
  els.chatMessages.innerHTML = '';
  appendMessage('system', '界面消息已清空。');
});

els.chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.busy) return;

  const message = els.chatInput.value.trim();
  if (!message) return;

  appendMessage('user', message);
  els.chatInput.value = '';
  updateCharCounter();

  state.streamingMessageBody = null;
  state.streamedText = '';

  try {
    setBusy(true, '聊天处理中...');
    const data = await callJson('/api/chat', {
      channel: 'web',
      sessionId: state.sessionId,
      message
    });

    if (!state.streamedText) {
      const isHtml = data.isCommand === true;
      appendMessage('assistant', data.reply || '(空响应)', false, isHtml);
    }
  } catch (error) {
    appendMessage('system', error instanceof Error ? error.message : String(error), true);
  } finally {
    state.streamingMessageBody = null;
    setBusy(false, '就绪');
  }
});

els.chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.commandDropdownVisible) {
    hideCommandDropdown();
    return;
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    hideCommandDropdown();
    els.chatForm.requestSubmit();
  }
});

els.chatInput.addEventListener('input', () => {
  updateCharCounter();
  const value = els.chatInput.value;
  const firstWord = value.split(/\s/)[0];
  if (firstWord.startsWith('/') && value === firstWord) {
    // User is still typing the command name (no space yet)
    const matches = filterCommands(firstWord);
    showCommandDropdown(matches);
  } else {
    hideCommandDropdown();
  }
});

els.chatInput.addEventListener('blur', () => {
  // Delay hide to allow mousedown on dropdown item to fire first
  setTimeout(hideCommandDropdown, 150);
});

els.takeScreenshotBtn.addEventListener('click', async () => {
  if (state.busy) return;

  try {
    setBusy(true, '正在获取截图...');
    const data = await callJson('/api/screenshot', {
      channel: 'web',
      sessionId: state.sessionId
    });

    els.screenshotImage.src = `data:${data.mimeType};base64,${data.imageBase64}`;
    els.screenshotImage.classList.remove('hidden');
    els.screenshotMeta.textContent = `mimeType: ${data.mimeType}\nsize(base64): ${data.imageBase64.length}`;
  } catch (error) {
    els.screenshotMeta.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    setBusy(false, '就绪');
  }
});

els.execForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.busy) return;

  const command = els.execInput.value.trim();
  if (!command) return;

  els.exitCodeOutput.classList.remove('exit-error');
  els.stderrOutput.classList.remove('error');

  try {
    setBusy(true, '正在执行命令...');
    const data = await callJson('/api/system/exec', {
      channel: 'web',
      sessionId: state.sessionId,
      command
    });

    els.exitCodeOutput.textContent = String(data.exitCode);
    els.exitCodeOutput.classList.toggle('exit-error', data.exitCode !== 0);
    els.stdoutOutput.textContent = data.stdout || '(empty)';
    els.stderrOutput.textContent = data.stderr || '(empty)';
    els.stderrOutput.classList.toggle('error', Boolean(data.stderr));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    els.exitCodeOutput.textContent = 'error';
    els.exitCodeOutput.classList.add('exit-error');
    els.stdoutOutput.textContent = '';
    els.stderrOutput.textContent = message;
    els.stderrOutput.classList.add('error');
  } finally {
    setBusy(false, '就绪');
  }
});

window.addEventListener('beforeunload', () => {
  closeRealtime();
});

init();
