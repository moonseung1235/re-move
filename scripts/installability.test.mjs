import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('private manifest requests include the signed-in browser session', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const link = html.match(/<link\b[^>]*\brel="manifest"[^>]*>/)?.[0];
  assert.ok(link);
  assert.ok(link.includes('crossorigin="use-credentials"'));
  assert.ok(link.includes('href="/manifest.webmanifest"'));
});
test('Android install icons have valid PNG data and matching 192/512 dimensions', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'),
  );
  assert.equal(manifest.name, 'ASCEND');
  assert.equal(manifest.display, 'standalone');
  assert.ok(new URL(manifest.start_url, 'https://app.test').pathname.startsWith(manifest.scope));
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(
      (candidate) => candidate.sizes === `${size}x${size}` && candidate.type === 'image/png',
    );
    assert.ok(icon);
    const bytes = readFileSync(new URL(`../public${icon.src}`, import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
});
