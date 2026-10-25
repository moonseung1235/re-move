import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Box3 } from 'three';

test('bundled HUMAN model contains the skeleton chains used by live retargeting', () => {
  const bytes = readFileSync(new URL('../public/models/HUMAN.fbx', import.meta.url));
  const model = new FBXLoader().parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const bounds = new Box3().setFromObject(model);
  assert.ok(Number.isFinite(bounds.max.y) && bounds.max.y > bounds.min.y);
  for (const side of ['l', 'r']) {
    for (const chain of [
      [`upperleg${side}`, `lowerleg${side}`, `foot${side}`],
      [`upperarm${side}`, `lowerarm${side}`, `hand${side}`],
    ]) {
      const [upper, lower, end] = chain.map((name) => model.getObjectByName(name));
      assert.ok(upper?.isBone && lower?.isBone && end?.isBone);
      assert.equal(lower.parent, upper);
      assert.equal(end.parent, lower);
    }
  }
});
