import { expect, it } from 'vitest';
import type { Frame } from '../../types';
import { frameAtTime } from './frameAtTime';

it('uses recorded timestamps for sparse samples and keeps missing tracking gaps empty', () => {
  const frames: Frame[] = [0, 0.1, 1.5].map((time) => ({ time, angle: 90, landmarks: [] }));
  expect(frameAtTime(frames, 0.12)).toBe(frames[1]);
  expect(frameAtTime(frames, 1.51)).toBe(frames[2]);
  expect(frameAtTime(frames, 0.8)).toBeUndefined();
  expect(frameAtTime([], 0)).toBeUndefined();
  expect(frameAtTime(frames, NaN)).toBeUndefined();
});
