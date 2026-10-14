// Adobe's boilerplate uses jest. These use node:test so you can run them with
// zero dependencies: node --test test/actions/
// The assertions are the same; port them to jest when you clone the boilerplate.

const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../../actions/configure_vehicle/index.js');

test('always returns content parts', async () => {
  const r = await handler({});
  assert.ok(Array.isArray(r.content));
  assert.equal(r.content[0].type, 'text');
});

test('structuredContent is a plain object, not a bare array', async () => {
  const r = await handler({});
  assert.equal(typeof r.structuredContent, 'object');
  assert.ok(!Array.isArray(r.structuredContent));
});

test('falls back to defaults when the model sends nothing', async () => {
  const { structuredContent: s } = await handler({});
  assert.equal(s.selections.trim, 's-awd');
  assert.equal(s.selections.paint, 'arctic-white');
  assert.equal(s.dropped.length, 0);
});

test('ignores arguments the model hallucinated', async () => {
  const { structuredContent: s } = await handler({ paint: 'unicorn-sparkle' });
  assert.equal(s.selections.paint, 'arctic-white');
});

test('rolls back an incompatible combination and explains why', async () => {
  const { structuredContent: s } = await handler({ roof: 'panoramic', pack: 'cold-climate' });
  assert.equal(s.selections.roof, 'fixed');
  assert.equal(s.dropped[0].rule, 'pano-excludes-cold-climate');
  assert.match(s.dropped[0].reason, /Cold Climate/);
});

test('marks unreachable options unavailable with a reason', async () => {
  const { structuredContent: s } = await handler({ trim: 's-awd' });
  const wheels = s.groups.find((g) => g.id === 'wheels');
  const r22 = wheels.options.find((o) => o.id === 'r22-black');
  assert.equal(r22.available, false);
  assert.match(r22.reason, /Dynamic SE/);
});

test('upgrading the trim unlocks the wheels', async () => {
  const { structuredContent: s } = await handler({ trim: 'dynamic-se', wheels: 'r22-black' });
  assert.equal(s.selections.wheels, 'r22-black');
  assert.equal(s.dropped.length, 0);
});

test('prices the build from base plus selected deltas', async () => {
  const { structuredContent: s } = await handler({ trim: 's-awd', pack: 'cold-climate' });
  assert.equal(s.price.base, 2640000);
  assert.equal(s.price.options, 95000);
  assert.equal(s.price.total, 2735000);
});

test('buildId is deterministic for the same selection', async () => {
  const a = await handler({ trim: 'dynamic-se', paint: 'crimson-red' });
  const b = await handler({ trim: 'dynamic-se', paint: 'crimson-red' });
  assert.equal(a.structuredContent.buildId, b.structuredContent.buildId);
});

test('instructs the host not to duplicate the widget in prose', async () => {
  const r = await handler({});
  assert.match(r._meta['openai/widgetDescription'], /Do NOT list the options/);
});
