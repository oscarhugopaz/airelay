require('dotenv').config();

const { Telegraf } = require('telegraf');
const { execFile } = require('child_process');
const { randomUUID } = require('crypto');
const { constants: fsConstants } = require('fs');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { buildAgentCommand, parseAgentOutput, getAgentLabel } = require('./agent');
const { readConfig, updateConfig } = require('./config-store');
const {
  chunkText,
  formatError,
  parseSlashCommand,
  extractCommandValue,
  extensionFromMime,
  extensionFromUrl,
  getAudioPayload,
  getImagePayload,
  isPathInside,
  extractImageTokens,
  buildPrompt,
} = require('./message-utils');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const AGENT_LABEL = getAgentLabel();

const PARAKEET_CMD = 'parakeet-mlx';
const PARAKEET_TIMEOUT_MS = 120000;

const IMAGE_DIR = path.resolve(path.join(os.tmpdir(), 'aipal', 'images'));
const IMAGE_TTL_HOURS = 24;
const IMAGE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const SCRIPTS_DIR =
  process.env.AIPAL_SCRIPTS_DIR ||
  process.env.AIBOT_SCRIPTS_DIR ||
  path.join(os.homedir(), '.config', 'aibot', 'scripts');
const SCRIPT_TIMEOUT_MS = Number(
  process.env.AIPAL_SCRIPT_TIMEOUT_MS || process.env.AIBOT_SCRIPT_TIMEOUT_MS || 120000
);
const SCRIPT_NAME_REGEX = /^[A-Za-z0-9_-]+$/;

const bot = new Telegraf(BOT_TOKEN);
const queues = new Map();
const threads = new Map();
const lastScriptOutputs = new Map();
const SCRIPT_CONTEXT_MAX_CHARS = 8000;
let globalModel;
let globalThinking;

async function hydrateGlobalSettings() {
  const config = await readConfig();
  if (config.model) globalModel = config.model;
  if (config.thinking) globalThinking = config.thinking;
}

function shellQuote(value) {
  const escaped = String(value).replace(/'/g, String.raw`'\''`);
  return `'${escaped}'`;
}

function execLocal(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: 'utf8', ...options }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        return reject(err);
      }
      resolve(stdout || '');
    });
  });
}

function splitArgs(input) {
  const args = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
        continue;
      }
      if (ch === '\\' && quote === '"' && i + 1 < input.length) {
        current += input[i + 1];
        i += 1;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }
    if (ch === '\\' && i + 1 < input.length) {
      current += input[i + 1];
      i += 1;
      continue;
    }
    current += ch;
  }
  if (current) args.push(current);
  return args;
}

async function runScriptCommand(commandName, rawArgs) {
  if (!SCRIPT_NAME_REGEX.test(commandName)) {
    throw new Error(`Invalid script name: ${commandName}`);
  }
  const scriptPath = path.resolve(SCRIPTS_DIR, commandName);
  if (!isPathInside(SCRIPTS_DIR, scriptPath)) {
    throw new Error(`Invalid script path: ${scriptPath}`);
  }
  try {
    await fs.access(scriptPath, fsConstants.X_OK);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new Error(`Script not found: ${scriptPath}`);
    }
    if (err && err.code === 'EACCES') {
      throw new Error(`Script not executable: ${scriptPath}`);
    }
    throw err;
  }
  const argv = splitArgs(rawArgs || '');
  return execLocal(scriptPath, argv, {
    timeout: SCRIPT_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
  });
}

function formatScriptContext(entry) {
  if (!entry) return '';
  const output = String(entry.output || '').trim() || '(no output)';
  if (output.length <= SCRIPT_CONTEXT_MAX_CHARS) {
    return `/${entry.name} output:\n${output}`;
  }
  const truncated = output.slice(0, SCRIPT_CONTEXT_MAX_CHARS);
  const remaining = output.length - SCRIPT_CONTEXT_MAX_CHARS;
  return `/${entry.name} output (truncated ${remaining} chars):\n${truncated}`;
}

function consumeScriptContext(chatId) {
  const entry = lastScriptOutputs.get(chatId);
  if (!entry) return '';
  lastScriptOutputs.delete(chatId);
  return formatScriptContext(entry);
}

async function replyWithError(ctx, label, err) {
  const detail = formatError(err);
  const text = `${label}\n${detail}`.trim();
  for (const chunk of chunkText(text, 3500)) {
    await ctx.reply(chunk);
  }
}

function startTyping(ctx) {
  const send = async () => {
    try {
      await ctx.sendChatAction('typing');
    } catch (err) {
      console.error('Typing error', err);
    }
  };
  send();
  const timer = setInterval(send, 4000);
  return () => clearInterval(timer);
}

async function downloadTelegramFile(ctx, payload, options = {}) {
  const {
    dir = path.join(os.tmpdir(), 'aipal'),
    prefix = 'file',
    errorLabel = 'file',
  } = options;
  const link = await ctx.telegram.getFileLink(payload.fileId);
  const url = typeof link === 'string' ? link : link.href;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${errorLabel} (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(dir, { recursive: true });
  const extFromName = payload.fileName ? path.extname(payload.fileName) : '';
  const ext = extFromName || extensionFromMime(payload.mimeType) || extensionFromUrl(url) || '.bin';
  const filePath = path.join(dir, `${prefix}-${randomUUID()}${ext}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function transcribeWithParakeet(audioPath) {
  const outputDir = path.join(os.tmpdir(), 'parakeet-mlx');
  await fs.mkdir(outputDir, { recursive: true });
  const outputTemplate = `parakeet-${randomUUID()}`;
  const args = [
    audioPath,
    '--output-dir',
    outputDir,
    '--output-format',
    'txt',
    '--output-template',
    outputTemplate,
  ];
  await execLocal(PARAKEET_CMD, args, { timeout: PARAKEET_TIMEOUT_MS });
  const outputPath = path.join(outputDir, `${outputTemplate}.txt`);
  const text = await fs.readFile(outputPath, 'utf8');
  return { text: text.trim(), outputPath };
}

async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {}
}

async function cleanupOldFiles(dir, maxAgeMs) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(dir, entry.name);
      const stat = await fs.stat(filePath);
      if (now - stat.mtimeMs > maxAgeMs) {
        await safeUnlink(filePath);
      }
    }
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.warn('Image cleanup failed:', err);
    }
  }
}

function startImageCleanup() {
  if (!Number.isFinite(IMAGE_TTL_HOURS) || IMAGE_TTL_HOURS <= 0) return;
  const maxAgeMs = IMAGE_TTL_HOURS * 60 * 60 * 1000;
  const run = () => cleanupOldFiles(IMAGE_DIR, maxAgeMs);
  run();
  if (Number.isFinite(IMAGE_CLEANUP_INTERVAL_MS) && IMAGE_CLEANUP_INTERVAL_MS > 0) {
    const timer = setInterval(run, IMAGE_CLEANUP_INTERVAL_MS);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }
}

async function runAgentForChat(chatId, prompt, options = {}) {
  const threadId = threads.get(chatId);
  const model = globalModel;
  const thinking = globalThinking;
  const finalPrompt = buildPrompt(
    prompt,
    options.imagePaths || [],
    IMAGE_DIR,
    options.scriptContext
  );
  const promptBase64 = Buffer.from(finalPrompt, 'utf8').toString('base64');
  const promptExpression = '"$PROMPT"';
  const agentCmd = buildAgentCommand(finalPrompt, {
    threadId,
    promptExpression,
    model,
    thinking,
  });
  const command = [
    `PROMPT_B64=${shellQuote(promptBase64)};`,
    'PROMPT=$(printf %s "$PROMPT_B64" | base64 --decode);',
    `${agentCmd}`,
  ].join(' ');

  const output = await execLocal('bash', ['-lc', command]);
  const parsed = parseAgentOutput(output);
  if (parsed.threadId) {
    threads.set(chatId, parsed.threadId);
  }
  if (parsed.sawJson) {
    return parsed.text || output;
  }
  return parsed.text || output;
}

async function replyWithResponse(ctx, response) {
  const { cleanedText, imagePaths } = extractImageTokens(response || '', IMAGE_DIR);
  const text = cleanedText.trim();
  if (text) {
    for (const chunk of chunkText(text, 3500)) {
      await ctx.reply(chunk);
    }
  }
  const uniqueImages = Array.from(new Set(imagePaths));
  for (const imagePath of uniqueImages) {
    try {
      if (!isPathInside(IMAGE_DIR, imagePath)) {
        console.warn('Skipping image outside IMAGE_DIR:', imagePath);
        continue;
      }
      await fs.access(imagePath);
      await ctx.replyWithPhoto({ source: imagePath });
    } catch (err) {
      console.warn('Failed to send image:', imagePath, err);
    }
  }
  if (!text && uniqueImages.length === 0) {
    await ctx.reply('(no response)');
  }
}

function enqueue(chatId, fn) {
  const prev = queues.get(chatId) || Promise.resolve();
  const next = prev.then(fn).catch((err) => {
    console.error('Queue error', err);
  });
  queues.set(chatId, next);
  return next;
}

bot.start((ctx) => ctx.reply(`Ready. Send a message and I will pass it to ${AGENT_LABEL}.`));

bot.command('model', async (ctx) => {
  const value = extractCommandValue(ctx.message.text);
  if (!value) {
    if (globalModel) {
      ctx.reply(`Current model: ${globalModel}`);
    } else {
      ctx.reply('No model set. Use /model <name>.');
    }
    return;
  }
  try {
    globalModel = value;
    await updateConfig({ model: value });
    ctx.reply(`Model set to ${value}.`);
  } catch (err) {
    console.error(err);
    await replyWithError(ctx, 'Failed to persist model.', err);
  }
});

bot.command('thinking', async (ctx) => {
  const value = extractCommandValue(ctx.message.text);
  if (!value) {
    if (globalThinking) {
      ctx.reply(`Current thinking: ${globalThinking}`);
    } else {
      ctx.reply('No thinking level set. Use /thinking <level>.');
    }
    return;
  }
  try {
    globalThinking = value;
    await updateConfig({ thinking: value });
    ctx.reply(`Thinking level set to ${value}.`);
  } catch (err) {
    console.error(err);
    await replyWithError(ctx, 'Failed to persist thinking level.', err);
  }
});

bot.command('reset', async (ctx) => {
  threads.delete(ctx.chat.id);
  ctx.reply('Session reset.');
});

bot.on('text', (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();
  if (!text) return;

  const slash = parseSlashCommand(text);
  if (slash) {
    const normalized = slash.name.toLowerCase();
    if (['start', 'model', 'thinking', 'reset'].includes(normalized)) return;
    enqueue(chatId, async () => {
      const stopTyping = startTyping(ctx);
      try {
        const output = await runScriptCommand(slash.name, slash.args);
        lastScriptOutputs.set(chatId, { name: slash.name, output });
        stopTyping();
        await replyWithResponse(ctx, output);
      } catch (err) {
        console.error(err);
        stopTyping();
        await replyWithError(ctx, `Error running /${slash.name}.`, err);
      }
    });
    return;
  }

  enqueue(chatId, async () => {
    const stopTyping = startTyping(ctx);
    try {
      const scriptContext = consumeScriptContext(chatId);
      const response = await runAgentForChat(chatId, text, { scriptContext });
      stopTyping();
      await replyWithResponse(ctx, response);
    } catch (err) {
      console.error(err);
      stopTyping();
      await replyWithError(ctx, 'Error processing response.', err);
    }
  });
});

bot.on(['voice', 'audio', 'document'], (ctx) => {
  const chatId = ctx.chat.id;
  const payload = getAudioPayload(ctx.message);
  if (!payload) return;

  enqueue(chatId, async () => {
    const stopTyping = startTyping(ctx);
    let audioPath;
    let transcriptPath;
    try {
      audioPath = await downloadTelegramFile(ctx, payload, {
        prefix: 'audio',
        errorLabel: 'audio',
      });
      const { text, outputPath } = await transcribeWithParakeet(audioPath);
      transcriptPath = outputPath;
      if (!text) {
        await ctx.reply("I couldn't transcribe the audio.");
        return;
      }
      const response = await runAgentForChat(chatId, text);
      await replyWithResponse(ctx, response);
    } catch (err) {
      console.error(err);
      if (err && err.code === 'ENOENT') {
        await replyWithError(
          ctx,
          "I can't find parakeet-mlx. Install it and try again.",
          err
        );
      } else {
        await replyWithError(ctx, 'Error processing audio.', err);
      }
    } finally {
      stopTyping();
      await safeUnlink(audioPath);
      await safeUnlink(transcriptPath);
    }
  });
});

bot.on(['photo', 'document'], (ctx) => {
  const chatId = ctx.chat.id;
  const payload = getImagePayload(ctx.message);
  if (!payload) return;

  enqueue(chatId, async () => {
    const stopTyping = startTyping(ctx);
    let imagePath;
    try {
      imagePath = await downloadTelegramFile(ctx, payload, {
        dir: IMAGE_DIR,
        prefix: 'image',
        errorLabel: 'image',
      });
      const caption = (ctx.message.caption || '').trim();
      const prompt = caption || 'User sent an image.';
      const response = await runAgentForChat(chatId, prompt, {
        imagePaths: [imagePath],
      });
      await replyWithResponse(ctx, response);
    } catch (err) {
      console.error(err);
      await replyWithError(ctx, 'Error processing image.', err);
    } finally {
      stopTyping();
    }
  });
});

startImageCleanup();
hydrateGlobalSettings().catch((err) => console.warn('Failed to load config settings:', err));
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
