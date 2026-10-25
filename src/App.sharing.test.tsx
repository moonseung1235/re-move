// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { CaptureRecord, Session } from './types';
import App from './App';
import {
  emptyData,
  readData,
  writeData,
  saveMedia,
  readMedia,
  deleteMedia,
} from './services/local';
import { getExercise } from './features/exercise-tracking/exercises';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: { div: ({ children }: { children: ReactNode }) => <div>{children}</div> },
}));
vi.mock('./features/pose-analysis/analyze', () => ({
  analyzeBlob: vi.fn().mockRejectedValue(new Error('test-only detection failure')),
}));
vi.mock('./features/pose-analysis/draw', () => ({ drawPose: vi.fn() }));
const session: Session = {
  id: 'measured-record',
  exerciseId: 'knee',
  recordedAt: '2026-10-24T00:00:00Z',
  duration: 1,
  side: 'left',
  cameraDirection: '측면',
  version: 'test-only',
  mediaId: 'measured-video',
  analysis: {
    min: 80,
    max: 150,
    range: 70,
    validRatio: 1,
    validFrames: 10,
    totalFrames: 10,
    repetitions: 0,
    frames: [],
  },
};
const capture: CaptureRecord = {
  id: 'raw-record',
  exerciseId: 'elbow',
  recordedAt: '2026-10-25T00:00:00Z',
  duration: 1,
  side: 'right',
  cameraDirection: '측면',
  status: 'failed',
  mediaId: 'raw-video',
  frames: [],
};
beforeEach(async () => {
  // fake-indexeddb uses Node structuredClone, so media fixtures must be native Blobs.
  const bufferModule = 'node:buffer';
  const nativeMedia = await import(bufferModule);
  vi.stubGlobal('Blob', nativeMedia.Blob);
  vi.stubGlobal('File', nativeMedia.File);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const NativeURL = URL;
  vi.stubGlobal(
    'URL',
    Object.assign(class extends NativeURL {}, {
      createObjectURL: vi.fn(() => 'blob:sharing-test'),
      revokeObjectURL: vi.fn(),
    }),
  );
  window.scrollTo = vi.fn();
  window.location.hash = '/records';
  const data = emptyData();
  data.symptoms = {
    description: '무릎 테스트',
    areas: ['knee'],
    side: 'left',
    professionalGuidance: false,
    updatedAt: '2026-10-25',
  };
  data.sessions = [session];
  data.captures = [capture];
  await writeData('local-demo', data);
  await saveMedia(
    'local-demo',
    session.mediaId!,
    new Blob(['measured-clip'], { type: 'video/mp4' }),
  );
  await saveMedia('local-demo', capture.mediaId!, new Blob(['raw-clip'], { type: 'video/webm' }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function composerUpload() {
  const upload = await screen.findByRole('button', { name: '업로드' });
  expect(upload.closest('.modal-heading')).not.toBeNull();
  expect(
    screen.getByRole('form', { name: '커뮤니티 게시물 작성' }).querySelector('video'),
  ).not.toBeNull();
  expect((await readData('local-demo')).posts).toHaveLength(0);
  return upload;
}
async function publishedMedia() {
  await waitFor(async () => expect((await readData('local-demo')).posts).toHaveLength(1));
  const post = (await readData('local-demo')).posts[0];
  return { post, media: await readMedia('local-demo', post.mediaId!) };
}

it('shares a measured video directly from records and keeps optional analysis private until selected', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /스쿼트 영상 공유/ }));
  const upload = await composerUpload();
  await user.click(screen.getByLabelText('관측 각도 범위'));
  await user.click(upload);
  const { post, media } = await publishedMedia();
  expect(post.shared).toEqual({ range: 70 });
  expect(media?.type).toBe('video/mp4');
  expect(media?.size).toBe('measured-clip'.length);
  expect((await readMedia('local-demo', session.mediaId!))?.size).toBe(media?.size);
  await user.click(screen.getByRole('button', { name: '게시글 작성' }));
  expect((screen.getByLabelText('나누고 싶은 이야기') as HTMLTextAreaElement).value).toBe('');
  expect(
    screen.getByRole('form', { name: '커뮤니티 게시물 작성' }).querySelector('video'),
  ).toBeNull();
});

it('shares an unanalysed original directly from records without requiring successful analysis', async () => {
  const user = userEvent.setup();
  render(<App />);
  const name = getExercise(capture.exerciseId).name;
  await user.click(await screen.findByRole('button', { name: new RegExp(`${name} 영상 공유`) }));
  await user.click(await composerUpload());
  const { post, media } = await publishedMedia();
  expect(post.shared).toEqual({});
  expect(media?.type).toBe('video/webm');
  expect(media?.size).toBe('raw-clip'.length);
});

it('uses the same visible upload action when posting from the capture review screen', async () => {
  const user = userEvent.setup();
  render(<App />);
  const name = getExercise(capture.exerciseId).name;
  await user.click(await screen.findByRole('button', { name: new RegExp(`${name}.*분석 대기`) }));
  const compose = await screen.findByRole('button', { name: '게시물 만들기' });
  await waitFor(() => expect((compose as HTMLButtonElement).disabled).toBe(false));
  await user.click(compose);
  const upload = await composerUpload();
  expect(upload.closest('.capture-active')).not.toBeNull();
  await user.click(upload);
  expect((await publishedMedia()).media?.size).toBe('raw-clip'.length);
});

it('explains a missing private original instead of silently attaching a different video', async () => {
  await deleteMedia('local-demo', session.mediaId!);
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /스쿼트 영상 공유/ }));
  await screen.findByText(/이 기기에 원본 영상이 없어요. 글이나 선택한 분석만/);
  expect(
    screen.getByRole('form', { name: '커뮤니티 게시물 작성' }).querySelector('video'),
  ).toBeNull();
  expect((await readData('local-demo')).posts).toHaveLength(0);
});
