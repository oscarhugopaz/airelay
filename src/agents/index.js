const codex = require('./codex');
const opencode = require('./opencode');

const agents = new Map([
  [codex.id, codex],
  [opencode.id, opencode],
]);

const DEFAULT_AGENT = opencode.id;

function normalizeAgent(value) {
  if (!value) return DEFAULT_AGENT;
  const normalized = String(value).trim().toLowerCase();
  if (agents.has(normalized)) return normalized;
  return DEFAULT_AGENT;
}

function isKnownAgent(value) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return agents.has(normalized);
}

function getAgent(value) {
  return agents.get(normalizeAgent(value));
}

function getAgentLabel(value) {
  return getAgent(value).label;
}

module.exports = {
  AGENT_CODEX: codex.id,
  AGENT_OPENCODE: opencode.id,
  normalizeAgent,
  isKnownAgent,
  getAgent,
  getAgentLabel,
};
