// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { Frame } from '../types';
import { exercises } from '../features/exercise-tracking/exercises';
import MotionViewer from './MotionViewer';

vi.mock('./PoseAvatar3D', () => ({
  PoseAvatar3D: ({ frame, mirrored, view }: { frame?: Frame; mirrored: boolean; view: string }) => (
    <output aria-label="테스트 아바타">
      {frame?.angle ?? 'missing'} / {String(mirrored)} / {view}
    </output>
  ),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const points = Array.from({ length: 33 }, (_, i) =>
  i < 11 ? null : { x: 0.5, y: i / 33, z: 0, visibility: 1 },
);
const frames: Frame[] = [
  { time: 0, angle: 90, landmarks: points, worldLandmarks: points },
  { time: 0.1, angle: 120, landmarks: points, worldLandmarks: points },
  { time: 0.2, angle: null, landmarks: [], worldLandmarks: [] },
];
const props = {
  exercise: exercises[0],
  side: 'left' as const,
  frames,
  duration: 1,
  mirrored: true,
};

it('replays saved 3D frames without an original video, including mirroring, seeking and view selection', async () => {
  const user = userEvent.setup();
  render(<MotionViewer {...props} />);
  expect(screen.getByText('이 기기에 원본 영상이 없어요.')).toBeDefined();
  await user.click(screen.getByRole('button', { name: '3D 동작' }));
  expect(await screen.findByText('3D 관절 좌표 기반')).toBeDefined();
  expect((await screen.findByLabelText('테스트 아바타')).textContent).toBe('90 / true / angle');
  fireEvent.change(screen.getByRole('slider'), { target: { value: '0.1' } });
  expect(screen.getByLabelText('테스트 아바타').textContent).toBe('120 / true / angle');
  await user.click(screen.getByRole('button', { name: '후면' }));
  expect(screen.getByLabelText('테스트 아바타').textContent).toBe('120 / true / back');
  fireEvent.change(screen.getByRole('slider'), { target: { value: '0.8' } });
  expect(screen.getByLabelText('테스트 아바타').textContent).toBe('missing / true / back');
  expect(screen.queryByRole('button', { name: /목표 각도와 비교/ })).toBeNull();
});

it('provides goal comparison only for an explicitly configured angle and labels legacy reconstruction', async () => {
  const user = userEvent.setup();
  render(
    <MotionViewer
      {...props}
      frames={frames.map(({ worldLandmarks: _, ...frame }) => frame)}
      targetAngle={150}
      initialView="3d"
    />,
  );
  expect(await screen.findByText('영상 좌표로 재구성')).toBeDefined();
  await user.click(screen.getByRole('button', { name: /목표 각도와 비교/ }));
  expect(await screen.findByText('목표 각도 예시')).toBeDefined();
  expect(screen.getByText('목표 150°')).toBeDefined();
  expect(screen.getAllByLabelText('테스트 아바타')).toHaveLength(2);
});

it('does not create a 3D replay when no person was detected', async () => {
  render(
    <MotionViewer {...props} frames={[{ time: 0, angle: null, landmarks: [] }]} initialView="3d" />,
  );
  expect(screen.getByText(/3D로 재생할 관절 정보가 없어요/)).toBeDefined();
  expect(screen.queryByLabelText('테스트 아바타')).toBeNull();
});

it('plays at the chosen speed and stops at the end of the recording', async () => {
  let tick: FrameRequestCallback = () => {};
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    tick = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const user = userEvent.setup();
  render(<MotionViewer {...props} initialView="3d" />);
  await screen.findByRole('slider');
  await user.selectOptions(screen.getByRole('combobox'), '2');
  await user.click(screen.getByRole('button', { name: '재생' }));
  now = 250;
  act(() => tick(now));
  expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('0.5');
  now = 500;
  act(() => tick(now));
  expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('1');
  expect(screen.getByRole('button', { name: '재생' })).toBeDefined();
});
