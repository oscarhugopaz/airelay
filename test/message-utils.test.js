const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  extractImageTokens,
  isPathInside,
  buildPrompt,
  parseSlashCommand,
} = require('../src/message-utils');

test('extractImageTokens keeps only images inside IMAGE_DIR', () => {
  const baseDir = path.join(os.tmpdir(), 'aipal-test-images');
  const inside = path.join(baseDir, 'img.png');
  const outside = path.join(os.tmpdir(), 'outside.png');
  const text = `hello [[image:${inside}]] [[image:${outside}]] [[image:relative.png]]`;
  const { cleanedText, imagePaths } = extractImageTokens(text, baseDir);
  assert.equal(cleanedText, 'hello');
  assert.deepEqual(imagePaths.sort(), [
    inside,
    path.join(baseDir, 'relative.png'),
  ].sort());
});

test('isPathInside detects containment', () => {
  const baseDir = path.join(os.tmpdir(), 'aipal-test');
  assert.equal(isPathInside(baseDir, path.join(baseDir, 'file.txt')), true);
  assert.equal(isPathInside(baseDir, path.join(os.tmpdir(), 'other.txt')), false);
});

test('buildPrompt includes image hints', () => {
  const baseDir = '/tmp/aipal/images';
  const prompt = buildPrompt('hello', ['/tmp/aipal/images/a.png'], baseDir);
  assert.match(prompt, /User sent image file/);
  assert.match(prompt, /\[\[image:\/absolute\/path\]\]/);
});

test('parseSlashCommand parses args', () => {
  const parsed = parseSlashCommand('/inbox --max 3');
  assert.deepEqual(parsed, { name: 'inbox', args: '--max 3' });
});

test('parseSlashCommand handles bot suffix', () => {
  const parsed = parseSlashCommand('/inbox@mybot');
  assert.deepEqual(parsed, { name: 'inbox', args: '' });
});
