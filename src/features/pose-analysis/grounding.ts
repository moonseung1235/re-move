import * as THREE from 'three';

export type GroundPoint = { position: THREE.Vector3; confidence: number };
export type GroundFoot = {
  hip: GroundPoint | null;
  knee: GroundPoint | null;
  ankle: GroundPoint | null;
  heel: GroundPoint | null;
  toe: GroundPoint | null;
};
export type FootSupport = 'left' | 'right' | 'both';
export type ContactState = { support: FootSupport; gap?: number; time?: number };
export type ContactHeights = { left: number | null; right: number | null };
export type GroundLegRig = {
  hip: THREE.Bone;
  knee: THREE.Bone;
  ankle: THREE.Bone;
  soles: THREE.Object3D[];
};

function reliable(point: GroundPoint | null): point is GroundPoint {
  return !!point && point.confidence >= 0.65 && point.position.toArray().every(Number.isFinite);
}
function legLength(foot: GroundFoot) {
  if (!reliable(foot.hip) || !reliable(foot.knee) || !reliable(foot.ankle)) return undefined;
  const upper = foot.hip.position.distanceTo(foot.knee.position);
  const lower = foot.knee.position.distanceTo(foot.ankle.position);
  return upper > 1e-4 && lower > 1e-4 ? upper + lower : undefined;
}
function observedSole(foot: GroundFoot, length: number) {
  const contacts = [foot.heel, foot.toe]
    .filter(reliable)
    .filter(
      (point) =>
        !reliable(foot.ankle) || point.position.distanceTo(foot.ankle.position) < length * 0.45,
    );
  // Heel/toe contact handles a tilted foot; ankle clearance is a fallback only.
  if (contacts.length) return Math.min(...contacts.map((point) => point.position.y));
  return reliable(foot.ankle) ? foot.ankle.position.y - length * 0.06 : undefined;
}

/** Standing assumption: the lower observed sole is the ground reference, regardless of knee angle. */
export function estimateContactHeights(
  left: GroundFoot,
  right: GroundFoot,
  modelLegLength: number,
  state: ContactState,
  time: number,
): ContactHeights {
  const lengths = [legLength(left), legLength(right)].filter(
    (length): length is number => length !== undefined,
  );
  if (!lengths.length) return { left: null, right: null };
  const length = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
  const leftY = observedSole(left, length);
  const rightY = observedSole(right, length);
  if (leftY === undefined && rightY === undefined) return { left: null, right: null };
  if (leftY === undefined) {
    state.support = 'right';
    state.gap = undefined;
    return { left: null, right: 0 };
  }
  if (rightY === undefined) {
    state.support = 'left';
    state.gap = undefined;
    return { left: 0, right: null };
  }
  const gap = ((rightY - leftY) * modelLegLength) / length;
  const elapsed = state.time === undefined ? Infinity : time - state.time;
  const reset = !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 0.5;
  const response = reset ? 1 : 1 - Math.exp(-Math.max(0, elapsed) / 0.07);
  state.gap = state.gap === undefined ? gap : THREE.MathUtils.lerp(state.gap, gap, response);
  state.time = time;
  const enterLift = modelLegLength * 0.045;
  const leaveLift = modelLegLength * 0.025;
  if (Math.abs(state.gap) <= leaveLift) state.support = 'both';
  else if (state.gap > enterLift) state.support = 'left';
  else if (state.gap < -enterLift) state.support = 'right';
  return {
    left: state.support === 'right' ? Math.max(0, -state.gap) : 0,
    right: state.support === 'left' ? Math.max(0, state.gap) : 0,
  };
}

/** Calibrate rigid sole samples from the actual skinned mesh, not the toe bone's height. */
export function createSoleMarkers(root: THREE.Object3D, foot: THREE.Bone): THREE.Object3D[] {
  root.updateMatrixWorld(true);
  const points: THREE.Vector3[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const indices = object.geometry.getAttribute('skinIndex');
    const weights = object.geometry.getAttribute('skinWeight');
    if (!indices || !weights) return;
    const boneIndex = object.skeleton.bones.indexOf(foot);
    if (boneIndex < 0) return;
    for (let index = 0; index < indices.count; index++) {
      let influence = 0;
      for (let axis = 0; axis < 4; axis++) {
        if (indices.getComponent(index, axis) === boneIndex)
          influence += weights.getComponent(index, axis);
      }
      if (influence < 0.55) continue;
      const point = object.getVertexPosition(index, new THREE.Vector3());
      object.localToWorld(point);
      if (point.toArray().every(Number.isFinite)) points.push(point);
    }
  });
  if (!points.length) {
    const ankle = foot.getWorldPosition(new THREE.Vector3());
    const toe = foot.children[0]?.getWorldPosition(new THREE.Vector3()) ?? ankle.clone();
    const soleY = Math.min(ankle.y, toe.y) - ankle.distanceTo(toe) * 0.08;
    points.push(ankle.clone().setY(soleY), toe.clone().setY(soleY));
  }
  const lowest = points.reduce((a, b) => (a.y < b.y ? a : b));
  const highest = points.reduce((a, b) => (a.y > b.y ? a : b));
  const bottom = points.filter(
    (point) => point.y <= lowest.y + Math.max(0.002, (highest.y - lowest.y) * 0.08),
  );
  const samples = new Set<THREE.Vector3>([lowest]);
  for (const axis of ['x', 'z'] as const) {
    samples.add(bottom.reduce((a, b) => (a[axis] < b[axis] ? a : b)));
    samples.add(bottom.reduce((a, b) => (a[axis] > b[axis] ? a : b)));
  }
  return [...samples].map((point, index) => {
    const marker = new THREE.Object3D();
    marker.name = `SoleContact${index}`;
    marker.position.copy(foot.worldToLocal(point.clone()));
    foot.add(marker);
    return marker;
  });
}

export function soleHeight(rig: GroundLegRig) {
  return Math.min(...rig.soles.map((sole) => sole.getWorldPosition(new THREE.Vector3()).y));
}

function pointBoneAt(bone: THREE.Bone, end: THREE.Bone, target: THREE.Vector3) {
  const start = bone.getWorldPosition(new THREE.Vector3());
  const current = end.getWorldPosition(new THREE.Vector3()).sub(start);
  const wanted = target.clone().sub(start);
  if (current.lengthSq() < 1e-10 || wanted.lengthSq() < 1e-10) return;
  const correction = new THREE.Quaternion().setFromUnitVectors(
    current.normalize(),
    wanted.normalize(),
  );
  const world = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(correction);
  const parent = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  bone.quaternion.copy(parent.invert().multiply(world));
  bone.updateWorldMatrix(true, true);
}

/** Analytic two-bone IK keeps bone lengths and bends toward the measured knee's plane. */
export function solveGroundLeg(rig: GroundLegRig, target: THREE.Vector3, pole?: THREE.Vector3) {
  const hip = rig.hip.getWorldPosition(new THREE.Vector3());
  const knee = rig.knee.getWorldPosition(new THREE.Vector3());
  const ankle = rig.ankle.getWorldPosition(new THREE.Vector3());
  const footRotation = rig.ankle.getWorldQuaternion(new THREE.Quaternion());
  const upper = hip.distanceTo(knee);
  const lower = knee.distanceTo(ankle);
  if (upper < 1e-6 || lower < 1e-6) return;
  const axis = target.clone().sub(hip);
  if (axis.lengthSq() < 1e-10) return;
  const distance = THREE.MathUtils.clamp(
    axis.length(),
    Math.abs(upper - lower) + 1e-6,
    upper + lower - 1e-6,
  );
  axis.normalize();
  let bend = (pole ?? knee).clone().sub(hip);
  bend.addScaledVector(axis, -bend.dot(axis));
  if (bend.lengthSq() < 1e-8) {
    bend = new THREE.Vector3(0, 0, 1).addScaledVector(axis, -axis.z);
    if (bend.lengthSq() < 1e-8) bend = new THREE.Vector3(1, 0, 0).addScaledVector(axis, -axis.x);
  }
  bend.normalize();
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const across = Math.sqrt(Math.max(0, upper * upper - along * along));
  const solvedKnee = hip.clone().addScaledVector(axis, along).addScaledVector(bend, across);
  const solvedAnkle = hip.clone().addScaledVector(axis, distance);
  pointBoneAt(rig.hip, rig.knee, solvedKnee);
  pointBoneAt(rig.knee, rig.ankle, solvedAnkle);
  const parent =
    rig.ankle.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  rig.ankle.quaternion.copy(parent.invert().multiply(footRotation));
  rig.ankle.updateWorldMatrix(true, true);
}

/** Place the pelvis from the support soles, then solve each leg to its observed clearance. */
export function groundStandingRig(
  root: THREE.Group,
  legs: { left: GroundLegRig; right: GroundLegRig },
  heights: ContactHeights,
  floorY: number,
  poles: { left?: THREE.Vector3; right?: THREE.Vector3 } = {},
) {
  root.updateMatrixWorld(true);
  const originalRoot = root.getWorldPosition(new THREE.Vector3());
  const entries = (['left', 'right'] as const).map((side) => ({
    side,
    rig: legs[side],
    height: heights[side],
  }));
  const supports = entries.filter((entry) => entry.height === 0);
  const active = supports.length ? supports : entries;
  // Use the highest support sole; IK can shorten the other leg rather than overextend it.
  root.position.y += Math.min(...active.map(({ rig }) => floorY - soleHeight(rig)));
  root.updateMatrixWorld(true);
  const targets = entries
    .filter((entry) => entry.height !== null)
    .map(({ side, rig, height }) => {
      const target = rig.ankle.getWorldPosition(new THREE.Vector3());
      target.y += floorY + height! - soleHeight(rig);
      return { side, rig, target };
    });
  // Lower the pelvis if a desired grounded ankle would otherwise exceed the model's reach.
  let drop = 0;
  for (const { rig, target } of targets) {
    const hip = rig.hip.getWorldPosition(new THREE.Vector3());
    const knee = rig.knee.getWorldPosition(new THREE.Vector3());
    const ankle = rig.ankle.getWorldPosition(new THREE.Vector3());
    const reach = hip.distanceTo(knee) + knee.distanceTo(ankle) - 1e-5;
    const horizontal = Math.hypot(hip.x - target.x, hip.z - target.z);
    const vertical = Math.sqrt(Math.max(0, reach * reach - horizontal * horizontal));
    drop = Math.max(drop, hip.y - target.y - vertical);
  }
  if (drop > 0) {
    root.position.y -= drop;
    root.updateMatrixWorld(true);
  }
  const offset = root.getWorldPosition(new THREE.Vector3()).sub(originalRoot);
  for (const { side, rig, target } of targets)
    solveGroundLeg(rig, target, poles[side]?.clone().add(offset));
  root.updateMatrixWorld(true);
  // Numerical/reach fallback: one visible sole always touches the floor; none penetrate it.
  root.position.y += floorY - Math.min(...entries.map(({ rig }) => soleHeight(rig)));
  root.updateMatrixWorld(true);
}
