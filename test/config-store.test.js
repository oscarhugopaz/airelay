const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

function loadConfigStore(configPath) {
  process.env.BOT_CONFIG_PATH = configPath;
  const modulePath = path.join(__dirname, '..', 'src', 'config-store.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('readConfig returns empty object when file is missing', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aipal-config-'));
  const filePath = path.join(dir, 'config.json');
  const { readConfig } = loadConfigStore(filePath);
  const config = await readConfig();
  assert.deepEqual(config, {});
});

test('updateConfig writes and merges config', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aipal-config-'));
  const filePath = path.join(dir, 'config.json');
  const { updateConfig, readConfig } = loadConfigStore(filePath);
  await updateConfig({ model: 'gpt-5.2' });
  await updateConfig({ thinking: 'medium' });
  const config = await readConfig();
  assert.deepEqual(config, { model: 'gpt-5.2', thinking: 'medium' });
});
