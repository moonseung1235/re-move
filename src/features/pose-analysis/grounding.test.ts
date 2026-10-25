import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  estimateContactHeights,
  groundStandingRig,
  soleHeight,
  solveGroundLeg,
  type ContactState,
  type GroundFoot,
  type GroundLegRig,
} from './grounding';

const point = (x: number, y: number, z = 0, confidence = 1) => ({
  position: new THREE.Vector3(x, y, z),
  confidence,
});
function observed(x: number, lift = 0): GroundFoot {
  return {
    hip: point(x, 1, 0),
    knee: point(x, 0.55 + lift / 2, 0),
    ankle: point(x, 0.1 + lift, 0),
    heel: point(x, lift, -0.1),
    toe: point(x, lift, 0.15),
  };
}
const state = (): ContactState => ({ support: 'both' });
const absent: GroundFoot = { hip: null, knee: null, ankle: null, heel: null, toe: null };

describe('standing contact from position and inclination', () => {
  it('keeps bent knees grounded when both heel/toe positions stay on the same floor', () => {
    const left = observed(-0.15),
      right = observed(0.15);
    left.knee = point(-0.15, 0.5, 0.35);
    right.knee = point(0.15, 0.5, 0.4);
    expect(estimateContactHeights(left, right, 1.1, state(), 0)).toEqual({ left: 0, right: 0 });
  });
  it('recognizes a raised straight diagonal leg without requiring knee flexion', () => {
    const left = observed(-0.15),
      right = observed(0.15, 0.26);
    right.knee = point(0.4, 0.68);
    right.ankle = point(0.65, 0.36);
    right.heel = point(0.65, 0.26, -0.1);
    right.toe = point(0.65, 0.26, 0.15);
    const heights = estimateContactHeights(left, right, 1.1, state(), 0);
    expect(heights.left).toBe(0);
    expect(heights.right).toBeGreaterThan(0.25);
  });
  it('uses heel or toe contact for a tilted foot rather than treating a high ankle as airborne', () => {
    const left = observed(-0.15),
      right = observed(0.15);
    right.ankle = point(0.15, 0.24);
    right.toe = point(0.15, 0.15, 0.2);
    expect(estimateContactHeights(left, right, 1.1, state(), 0)).toEqual({ left: 0, right: 0 });
    right.toe = point(0.15, 0, 0.2);
    right.heel = point(0.15, 0.12, -0.1);
    expect(estimateContactHeights(left, right, 1.1, state(), 0)).toEqual({ left: 0, right: 0 });
  });
  it('is invariant to camera/body translation and horizontal mirroring', () => {
    const left = observed(-0.15),
      right = observed(0.15, 0.3);
    const before = estimateContactHeights(left, right, 1.1, state(), 0);
    for (const foot of [left, right])
      for (const value of Object.values(foot)) {
        if (value) {
          value.position.x *= -1;
          value.position.y += 3;
        }
      }
    const after = estimateContactHeights(left, right, 1.1, state(), 0);
    expect(after.left).toBe(before.left);
    expect(after.right).toBeCloseTo(before.right!, 8);
  });
  it('switches support sides and always leaves at least one grounded foot', () => {
    const contact = state();
    const first = estimateContactHeights(observed(-0.15), observed(0.15, 0.3), 1.1, contact, 0);
    expect(first.left).toBe(0);
    expect(first.right).toBeGreaterThan(0.2);
    const second = estimateContactHeights(observed(-0.15, 0.3), observed(0.15), 1.1, contact, 1);
    expect(second.left).toBeGreaterThan(0.2);
    expect(second.right).toBe(0);
  });
  it('does not alternate contact because of small landmark noise', () => {
    const contact = state();
    for (let index = 0; index < 20; index++) {
      const lift = index % 2 ? 0.004 : -0.004;
      expect(
        estimateContactHeights(observed(-0.15), observed(0.15, lift), 1.1, contact, index / 10),
      ).toEqual({ left: 0, right: 0 });
    }
  });
  it('uses the remaining observed foot and does not invent heights for missing/low-confidence joints', () => {
    expect(estimateContactHeights(observed(-0.15), absent, 1.1, state(), 0)).toEqual({
      left: 0,
      right: null,
    });
    const hidden = observed(0.15);
    Object.values(hidden).forEach((value) => {
      if (value) value.confidence = 0.1;
    });
    expect(estimateContactHeights(observed(-0.15), hidden, 1.1, state(), 0)).toEqual({
      left: 0,
      right: null,
    });
    expect(estimateContactHeights(absent, absent, 1.1, state(), 0)).toEqual({
      left: null,
      right: null,
    });
  });
});

function model() {
  const root = new THREE.Group();
  root.position.y = 2;
  function leg(x: number): GroundLegRig {
    const hip = new THREE.Bone(),
      knee = new THREE.Bone(),
      ankle = new THREE.Bone();
    hip.position.set(x, 1.1, 0);
    knee.position.y = -0.5;
    ankle.position.y = -0.5;
    root.add(hip);
    hip.add(knee);
    knee.add(ankle);
    const soles = [-0.1, 0.15].map((z) => {
      const sole = new THREE.Object3D();
      sole.position.set(0, -0.1, z);
      ankle.add(sole);
      return sole;
    });
    return { hip, knee, ankle, soles };
  }
  return { root, legs: { left: leg(-0.15), right: leg(0.15) } };
}

describe('model sole contact and inverse kinematics', () => {
  it('lowers the pelvis for a squat while keeping both soles on the floor', () => {
    const { root, legs } = model();
    groundStandingRig(root, legs, { left: 0, right: 0 }, 0);
    const standingHip = legs.left.hip.getWorldPosition(new THREE.Vector3()).y;
    for (const leg of Object.values(legs)) {
      leg.hip.rotation.x = -0.6;
      leg.knee.rotation.x = 1.2;
    }
    groundStandingRig(root, legs, { left: 0, right: 0 }, 0);
    expect(soleHeight(legs.left)).toBeCloseTo(0, 5);
    expect(soleHeight(legs.right)).toBeCloseTo(0, 5);
    expect(legs.left.hip.getWorldPosition(new THREE.Vector3()).y).toBeLessThan(standingHip - 0.1);
  });
  it('places a raised foot at the observed clearance while the supporting foot stays grounded', () => {
    const { root, legs } = model();
    groundStandingRig(root, legs, { left: 0, right: 0.3 }, 0);
    expect(soleHeight(legs.left)).toBeCloseTo(0, 5);
    expect(soleHeight(legs.right)).toBeCloseTo(0.3, 5);
  });
  it('grounds unequal leg bends independently instead of averaging them into floating/penetrating feet', () => {
    const { root, legs } = model();
    legs.left.knee.rotation.x = 0.9;
    legs.right.knee.rotation.x = 0.25;
    groundStandingRig(root, legs, { left: 0, right: 0 }, 0);
    expect(soleHeight(legs.left)).toBeCloseTo(0, 5);
    expect(soleHeight(legs.right)).toBeCloseTo(0, 5);
  });
  it('uses the lowest tilted sole contact and preserves foot orientation and segment lengths', () => {
    const { root, legs } = model();
    legs.right.ankle.rotation.x = 0.45;
    root.updateMatrixWorld(true);
    const rotation = legs.right.ankle.getWorldQuaternion(new THREE.Quaternion());
    groundStandingRig(root, legs, { left: 0, right: 0 }, 0);
    expect(soleHeight(legs.right)).toBeCloseTo(0, 5);
    expect(
      rotation.angleTo(legs.right.ankle.getWorldQuaternion(new THREE.Quaternion())),
    ).toBeCloseTo(0, 5);
    for (const leg of Object.values(legs)) {
      const hip = leg.hip.getWorldPosition(new THREE.Vector3()),
        knee = leg.knee.getWorldPosition(new THREE.Vector3()),
        ankle = leg.ankle.getWorldPosition(new THREE.Vector3());
      expect(hip.distanceTo(knee)).toBeCloseTo(0.5, 6);
      expect(knee.distanceTo(ankle)).toBeCloseTo(0.5, 6);
      expect(soleHeight(leg)).toBeGreaterThanOrEqual(-1e-7);
    }
  });
  it('bends toward the measured knee plane rather than assuming bend means lift', () => {
    const { root, legs } = model();
    root.position.y = 0;
    root.updateMatrixWorld(true);
    solveGroundLeg(legs.left, new THREE.Vector3(-0.15, 0.4, 0), new THREE.Vector3(-0.15, 0.7, 0.4));
    expect(legs.left.ankle.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(0.4, 6);
    expect(legs.left.knee.getWorldPosition(new THREE.Vector3()).z).toBeGreaterThan(0.3);
  });
  it('keeps a visible contact during lost tracking without imposing a fixed pelvis-height clamp', () => {
    const { root, legs } = model();
    root.position.y = 10;
    groundStandingRig(root, legs, { left: null, right: null }, -1.2);
    expect(Math.min(soleHeight(legs.left), soleHeight(legs.right))).toBeCloseTo(-1.2, 6);
  });
});
