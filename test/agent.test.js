const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadAgent(env = {}) {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
  const modulePath = path.join(__dirname, '..', 'src', 'agent.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('buildAgentCommand uses exec resume with thread id', () => {
  const { buildAgentCommand } = loadAgent({
    CODEX_CMD: 'codex',
    CODEX_ARGS: '--json',
    CODEX_TEMPLATE: '',
  });
  const agentConfig = {
    type: 'codex',
    cmd: 'codex',
    args: '--json',
    output: 'codex-json',
    session: { strategy: 'thread' },
    modelArg: '--model',
    thinkingArg: '--thinking',
  };
  const command = buildAgentCommand('hello', { threadId: 't-123' }, agentConfig);
  assert.match(command, /exec resume 't-123'/);
  assert.match(command, /--json/);
  assert.match(command, /'hello'/);
});

test('buildAgentCommand does not append modelArg when template uses {model}', () => {
  const { buildAgentCommand } = loadAgent();
  const agentConfig = {
    type: 'generic',
    template: 'mycli {prompt} {model}',
    output: 'text',
    modelArg: '--model',
  };
  const command = buildAgentCommand('ping', { model: 'gpt-5.2' }, agentConfig);
  assert.match(command, /mycli/);
  assert.match(command, /'gpt-5.2'/);
  assert.doesNotMatch(command, /--model/);
});

test('parseCodexJsonOutput extracts thread id and message text', () => {
  const { parseAgentOutput } = loadAgent();
  const output = [
    'noise',
    JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }),
    JSON.stringify({
      type: 'item.completed',
      item: { type: 'message', text: 'hi there' },
    }),
  ].join('\n');
  const parsed = parseAgentOutput(output, { output: 'codex-json' });
  assert.equal(parsed.threadId, 'thread-1');
  assert.equal(parsed.text, 'hi there');
  assert.equal(parsed.sawJson, true);
});
