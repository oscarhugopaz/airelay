const { resolvePromptValue } = require('./utils');

const GEMINI_CMD = 'gemini';
const GEMINI_OUTPUT_FORMAT = 'json';

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildCommand({ prompt, promptExpression }) {
  const promptValue = resolvePromptValue(prompt, promptExpression);
  const args = ['-p', promptValue, '--output-format', GEMINI_OUTPUT_FORMAT, '--yolo'];
  return `${GEMINI_CMD} ${args.join(' ')}`.trim();
}

function parseOutput(output) {
  const trimmed = String(output || '').trim();
  if (!trimmed) return { text: '', threadId: undefined, sawJson: false };
  const payload = safeJsonParse(trimmed);
  if (!payload || typeof payload !== 'object') {
    return { text: trimmed, threadId: undefined, sawJson: false };
  }
  if (payload.error && payload.error.message) {
    return { text: String(payload.error.message), threadId: undefined, sawJson: true };
  }
  const response = typeof payload.response === 'string' ? payload.response.trim() : '';
  return { text: response, threadId: undefined, sawJson: true };
}

module.exports = {
  id: 'gemini',
  label: 'gemini',
  needsPty: false,
  mergeStderr: false,
  buildCommand,
  parseOutput,
};
