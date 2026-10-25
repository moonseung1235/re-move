import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Pause, Play } from 'lucide-react';
import type { Exercise, Frame, Side } from '../types';
import type { PoseAvatarView } from './PoseAvatar3D';
import { VideoOverlay } from './VideoOverlay';
import { frameAtTime } from '../features/pose-analysis/frameAtTime';
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;

const PoseAvatar3D = lazy(() =>
  import('./PoseAvatar3D').then(({ PoseAvatar3D }) => ({ default: PoseAvatar3D })),
);

export default function RecordingComparison({
  url,
  loading = false,
  exercise,
  side,
  frames,
  duration,
  mirrored = false,
  overlay = true,
  videoRef,
}: {
  url?: string;
  loading?: boolean;
  exercise: Exercise;
  side: Side;
  frames: Frame[];
  duration: number;
  mirrored?: boolean;
  overlay?: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
}) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const video = videoRef ?? localVideo;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [actualDuration, setActualDuration] = useState<number>();
  const [view, setView] = useState<PoseAvatarView>('angle');
  const [viewResetKey, setViewResetKey] = useState(0);
  const [error, setError] = useState('');
  const pendingSeek = useRef<number | undefined>(undefined);
  const total = Math.max(actualDuration ?? duration, frames.at(-1)?.time ?? 0, 0.1);
  const hasPose = frames.some((frame) => frame.landmarks.some(Boolean));
  const frame = useMemo(() => frameAtTime(frames, time), [frames, time]);

  useEffect(() => {
    const element = video.current;
    if (!element || !url) return;
    setPlaying(false);
    const sync = () => {
      setTime(element.currentTime);
      setPlaying(!element.paused && !element.ended);
      if (Number.isFinite(element.duration) && element.duration > 0)
        setActualDuration(element.duration);
    };
    const loaded = () => {
      if (pendingSeek.current !== undefined) {
        element.currentTime = pendingSeek.current;
        pendingSeek.current = undefined;
      }
      sync();
    };
    const events = ['play', 'pause', 'ended', 'seeked', 'timeupdate'];
    events.forEach((name) => element.addEventListener(name, sync));
    element.addEventListener('loadedmetadata', loaded);
    return () => {
      events.forEach((name) => element.removeEventListener(name, sync));
      element.removeEventListener('loadedmetadata', loaded);
      element.pause();
    };
  }, [url, video]);

  useEffect(() => {
    if (!playing) return;
    let animation = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (url && video.current) setTime(video.current.currentTime);
      else {
        const delta = Math.min((now - last) / 1000, 0.25);
        setTime((current) => Math.min(total, current + delta));
      }
      last = now;
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [playing, url, total, video]);

  useEffect(() => {
    if (time >= total) setPlaying(false);
  }, [time, total]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) {
        video.current?.pause();
        setPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, [video]);

  function seek(value: number) {
    const next = Math.max(0, Math.min(total, value));
    if (url && video.current) {
      if (video.current.readyState >= 1) video.current.currentTime = next;
      else pendingSeek.current = next;
    }
    setTime(next);
  }
  async function togglePlay() {
    setError('');
    if (playing) {
      video.current?.pause();
      setPlaying(false);
      return;
    }
    if (time >= total - 0.02) seek(0);
    if (url && video.current) {
      try {
        await video.current.play();
        setPlaying(true);
      } catch {
        setError('재생 버튼을 다시 눌러 주세요.');
      }
    } else setPlaying(true);
  }

  return (
    <section className="recording-comparison" aria-label="영상과 3D 동작 비교">
      <div className="recording-comparison-grid">
        <div className="recording-comparison-panel">
          <h2>영상</h2>
          <div className="recording-comparison-stage">
            {url ? (
              <VideoOverlay
                url={url}
                exercise={exercise}
                side={side}
                frames={overlay ? frames : []}
                mirrored={mirrored}
                videoRef={video}
                controls={false}
              />
            ) : (
              <p className="recording-comparison-empty">
                {loading ? '영상 불러오는 중…' : '원본 영상이 없어요'}
              </p>
            )}
          </div>
        </div>
        <div className="recording-comparison-panel">
          <h2>3D 모델</h2>
          <div className="recording-comparison-stage">
            {hasPose ? (
              <Suspense fallback={<div className="pose-review-loading">3D 모델 준비 중…</div>}>
                <PoseAvatar3D
                  frame={frame}
                  exercise={exercise}
                  side={side}
                  mirrored={mirrored}
                  view={view}
                  viewResetKey={viewResetKey}
                  hideChrome
                />
              </Suspense>
            ) : (
              <p className="recording-comparison-empty">분석 후 표시돼요</p>
            )}
          </div>
        </div>
      </div>
      <div className="comparison-playback">
        <button
          aria-label={playing ? '비교 일시정지' : '비교 재생'}
          onClick={() => void togglePlay()}
          disabled={!url && !hasPose}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <input
          aria-label="영상과 3D 재생 위치"
          type="range"
          min={0}
          max={total}
          step={0.01}
          value={time}
          disabled={!url && !hasPose}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span>
          {clock(time)} / {clock(total)}
        </span>
      </div>
      {hasPose && (
        <div className="pose-view-switch" role="group" aria-label="홈 3D 시점">
          {(['front', 'side', 'back', 'angle'] as const).map((name) => (
            <button
              key={name}
              aria-pressed={view === name}
              onClick={() => {
                setView(name);
                setViewResetKey((key) => key + 1);
              }}
            >
              {{ front: '정면', side: '측면', back: '후면', angle: '사선' }[name]}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="comparison-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
