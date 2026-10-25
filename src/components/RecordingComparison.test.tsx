// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Frame } from '../types';
import { exercises } from '../features/exercise-tracking/exercises';
import RecordingComparison from './RecordingComparison';

vi.mock('../features/pose-analysis/draw', () => ({ drawPose: vi.fn() }));
vi.mock('./PoseAvatar3D', () => ({
  PoseAvatar3D: ({ frame, view }: { frame?: Frame; view: string }) => (
    <output aria-label="동기화 테스트 모델">
      {frame?.time ?? 'missing'} / {view}
    </output>
  ),
}));
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, 'paused', { configurable: true, value: false });
    this.dispatchEvent(new Event('play'));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, 'paused', { configurable: true, value: true });
    this.dispatchEvent(new Event('pause'));
  });
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const points = Array.from({ length: 33 }, (_, index) =>
  index < 11 ? null : { x: 0.5, y: index / 33, z: 0, visibility: 1 },
);
const frames: Frame[] = [0, 0.1, 0.2].map((time) => ({
  time,
  angle: 90,
  landmarks: points,
  worldLandmarks: points,
}));
const props = { exercise: exercises[0], side: 'left' as const, frames, duration: 1 };

it('shows video on the left and a synchronized model on the right with one playback control', async () => {
  const user = userEvent.setup();
  render(<RecordingComparison {...props} url="blob:recording" />);
  expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
    '영상',
    '3D 모델',
  ]);
  expect((await screen.findByLabelText('동기화 테스트 모델')).textContent).toBe('0 / angle');
  const video = screen.getByLabelText(`${exercises[0].name} 분석 영상`) as HTMLVideoElement;
  Object.defineProperty(video, 'readyState', { value: 1 });
  fireEvent.change(screen.getByRole('slider'), { target: { value: '0.1' } });
  expect(video.currentTime).toBe(0.1);
  expect(screen.getByLabelText('동기화 테스트 모델').textContent).toBe('0.1 / angle');
  await user.click(screen.getByRole('button', { name: '비교 재생' }));
  expect(video.play).toHaveBeenCalledOnce();
  video.currentTime = 0.2;
  fireEvent.timeUpdate(video);
  expect(screen.getByLabelText('동기화 테스트 모델').textContent).toBe('0.2 / angle');
  await user.click(screen.getByRole('button', { name: '비교 일시정지' }));
  expect(video.paused).toBe(true);
  await user.click(screen.getByRole('button', { name: '측면' }));
  expect(screen.getByLabelText('동기화 테스트 모델').textContent).toBe('0.2 / side');
});

it('keeps the recorded model available when the original video is absent', async () => {
  render(<RecordingComparison {...props} />);
  expect(screen.getByText('원본 영상이 없어요')).toBeDefined();
  await screen.findByLabelText('동기화 테스트 모델');
  fireEvent.change(screen.getByRole('slider'), { target: { value: '0.1' } });
  expect(screen.getByLabelText('동기화 테스트 모델').textContent).toBe('0.1 / angle');
});

it('shows analysis pending without fabricating a 3D person', () => {
  render(<RecordingComparison {...props} frames={[]} />);
  expect(screen.getByText('분석 후 표시돼요')).toBeDefined();
  expect(screen.queryByLabelText('동기화 테스트 모델')).toBeNull();
  expect((screen.getByRole('button', { name: '비교 재생' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});
