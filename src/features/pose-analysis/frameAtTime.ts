import type { Frame } from '../../types';

/** Find a nearby recorded sample without bridging a gap in tracking. */
export function frameAtTime(frames: Frame[], time: number, tolerance = 0.18): Frame | undefined {
  if (!frames.length || !Number.isFinite(time)) return undefined;
  let left = 0;
  let right = frames.length;
  while (left < right) {
    const middle = (left + right) >>> 1;
    if (frames[middle].time < time) left = middle + 1;
    else right = middle;
  }
  const before = frames[left - 1];
  const after = frames[left];
  const sample = !before
    ? after
    : !after
      ? before
      : Math.abs(before.time - time) <= Math.abs(after.time - time)
        ? before
        : after;
  return sample && Math.abs(sample.time - time) <= tolerance ? sample : undefined;
}
