const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const moduleMock = { exports: {} };
vm.runInNewContext(source, {
  module: moduleMock,
  exports: moduleMock.exports,
  require: (name) => name === 'obsidian'
    ? { Plugin: class {}, PluginSettingTab: class {}, Setting: class {}, Notice: class {} }
    : require(name),
  console,
  process,
  Buffer,
  setTimeout,
  clearTimeout,
});

async function plugin() {
  const instance = new moduleMock.exports.default();
  instance.loadData = async () => null;
  instance.addSettingTab = () => {};
  instance.registerMarkdownCodeBlockProcessor = () => {};
  instance.addCommand = () => {};
  await instance.onload();
  return instance;
}

test('evaluates a block with assignments and a shared block scope', async () => {
  const calculator = await plugin();
  const results = calculator.evaluateBlock('subtotal = 200\ntax = 8%\nsubtotal * tax');
  assert.equal(results.length, 3);
  assert.equal(results[2].result, '16.00');
});

test('handles the percent-of syntax and unit calculations', async () => {
  const calculator = await plugin();
  const percent = calculator.evaluateLine('50% of 200', calculator.sessionScope);
  assert.equal(percent.error, undefined, percent.error);
  assert.equal(percent.result, '100.00');
  const unit = calculator.evaluateLine('2 inch + 3 cm', calculator.sessionScope);
  assert.equal(unit.error, undefined);
  assert.match(unit.result, /inch|cm/);
  const converted = calculator.evaluateLine('(2 hour + 30 min) to minutes', calculator.sessionScope);
  assert.equal(converted.error, undefined, converted.error);
  assert.equal(converted.result, '150.00 minute');
});
