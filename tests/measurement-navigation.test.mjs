import test from 'node:test';
import assert from 'node:assert/strict';
import { measurementsHref, applicationHref } from '../src/front/sketch/como-medimos/navigation.js';

test('the informational page round trip preserves crew, example mode and view for each entry', () => {
  for (const entry of ['index.html', 'vuelo.html', 'overview.html']) {
    const original = `https://trama.test/${entry}?crew=CM-3&source=example#aerobica`;
    const annex = measurementsHref(original);
    assert.equal(applicationHref(new URL(annex, original)), `/${entry}?crew=CM-3&source=example#aerobica`);
  }
});
test('a crew selection reaches the annex before the URL synchronization effect runs', () => {
  const href = measurementsHref('https://trama.test/vuelo.html?crew=CM-1#vitales', 'CM-2');
  assert.equal(new URL(href, 'https://trama.test').searchParams.get('crew'), 'CM-2');
});
test('direct access has a local default and ignores arbitrary return targets', () => {
  assert.equal(applicationHref('https://trama.test/como-medimos.html'), '/index.html#summary');
  assert.equal(applicationHref('https://trama.test/como-medimos.html?from=https://other.test&view=unknown&crew=CM-2'), '/index.html?crew=CM-2#summary');
});
