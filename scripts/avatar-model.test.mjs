import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Box3, Vector3 } from 'three';

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

test(
  'actual FBX soles remain grounded through knee bends and one-foot lifts',
  {
    skip: !process.features.typescript,
  },
  async () => {
    const { createSoleMarkers, groundStandingRig, soleHeight } =
      await import('../src/features/pose-analysis/grounding.ts');
    const bytes = readFileSync(new URL('../public/models/HUMAN.fbx', import.meta.url));
    const model = new FBXLoader().parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    const bounds = new Box3().setFromObject(model);
    model.scale.setScalar(2.35 / (bounds.max.y - bounds.min.y));
    model.position.y = -1.18 - bounds.min.y * model.scale.y;
    model.updateMatrixWorld(true);
    const leg = (side) => {
      const ankle = model.getObjectByName(`foot${side}`);
      return {
        hip: model.getObjectByName(`upperleg${side}`),
        knee: model.getObjectByName(`lowerleg${side}`),
        ankle,
        soles: createSoleMarkers(model, ankle),
      };
    };
    const legs = { left: leg('l'), right: leg('r') };
    const initialY = model.position.y;
    const rotations = new Map();
    model.traverse((object) => {
      if (object.isBone) rotations.set(object, object.quaternion.clone());
    });
    for (const heights of [
      { left: 0, right: 0 },
      { left: 0, right: 0.3 },
      { left: 0.25, right: 0 },
    ]) {
      for (const [bone, rotation] of rotations) bone.quaternion.copy(rotation);
      model.position.y = initialY;
      legs.left.hip.rotation.x -= 0.5;
      legs.left.knee.rotation.x += 1;
      legs.right.knee.rotation.x += 0.25;
      groundStandingRig(model, legs, heights, -1.2);
      for (const side of ['left', 'right']) {
        assert.ok(legs[side].soles.length >= 2);
        assert.ok(Math.abs(soleHeight(legs[side]) + 1.2 - heights[side]) < 1e-4);
        assert.ok(legs[side].hip.getWorldPosition(new Vector3()).toArray().every(Number.isFinite));
        // Check the deformed mesh as well as the calibrated contact markers.
        let meshSole = Infinity;
        model.traverse((object) => {
          if (!object.isSkinnedMesh) return;
          const boneIndex = object.skeleton.bones.indexOf(legs[side].ankle);
          const indices = object.geometry.getAttribute('skinIndex');
          const weights = object.geometry.getAttribute('skinWeight');
          for (let vertex = 0; vertex < indices.count; vertex++) {
            let influence = 0;
            for (let axis = 0; axis < 4; axis++) {
              if (indices.getComponent(vertex, axis) === boneIndex)
                influence += weights.getComponent(vertex, axis);
            }
            if (influence < 0.9) continue;
            const point = object.getVertexPosition(vertex, new Vector3());
            object.localToWorld(point);
            meshSole = Math.min(meshSole, point.y);
          }
        });
        assert.ok(
          Math.abs(meshSole + 1.2 - heights[side]) < 0.02,
          `deformed ${side} sole: ${meshSole}`,
        );
      }
      for (let frame = 0; frame < 30; frame++) groundStandingRig(model, legs, heights, -1.2);
      assert.ok(Math.abs(Math.min(soleHeight(legs.left), soleHeight(legs.right)) + 1.2) < 1e-5);
    }
  },
);
