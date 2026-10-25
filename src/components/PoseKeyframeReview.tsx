import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { FastForward, Pause, Play, Rewind, RotateCcw } from 'lucide-react';
import type { Exercise, Frame, Landmark, Session } from '../types';
import type { PoseAvatarView } from './PoseAvatar3D';

const PoseAvatar3D = lazy(() =>
  import('./PoseAvatar3D').then(({ PoseAvatar3D: Avatar }) => ({ default: Avatar })),
);

function correctedPoints(
  points: (Landmark | null)[],
  joint: [number, number, number],
  target: number,
  worldSpace: boolean,
) {
  const next = points.map((point) => (point ? { ...point } : null));
  const [aIndex, bIndex, cIndex] = joint;
  const a = next[aIndex];
  const b = next[bIndex];
  const c = next[cIndex];
  if (!a || !b || !c) return next;

  const old = { x: c.x, y: c.y, z: c.z };
  const targetRadians = (target * Math.PI) / 180;
  if (worldSpace) {
    const ux = a.x - b.x;
    const uy = a.y - b.y;
    const uz = a.z - b.z;
    const vx = c.x - b.x;
    const vy = c.y - b.y;
    const vz = c.z - b.z;
    const upperLength = Math.hypot(ux, uy, uz);
    const lowerLength = Math.hypot(vx, vy, vz);
    if (upperLength < 1e-6 || lowerLength < 1e-6) return next;
    const nx = ux / upperLength;
    const ny = uy / upperLength;
    const nz = uz / upperLength;
    const projection = vx * nx + vy * ny + vz * nz;
    let px = vx - projection * nx;
    let py = vy - projection * ny;
    let pz = vz - projection * nz;
    let perpendicularLength = Math.hypot(px, py, pz);
    if (perpendicularLength < 1e-6) {
      px = -ny;
      py = nx;
      pz = 0;
      perpendicularLength = Math.hypot(px, py, pz) || 1;
    }
    px /= perpendicularLength;
    py /= perpendicularLength;
    pz /= perpendicularLength;
    c.x = b.x + lowerLength * (Math.cos(targetRadians) * nx + Math.sin(targetRadians) * px);
    c.y = b.y + lowerLength * (Math.cos(targetRadians) * ny + Math.sin(targetRadians) * py);
    c.z = b.z + lowerLength * (Math.cos(targetRadians) * nz + Math.sin(targetRadians) * pz);
  } else {
    const ab = Math.atan2(a.y - b.y, a.x - b.x);
    const cross = (a.x - b.x) * (c.y - b.y) - (a.y - b.y) * (c.x - b.x);
    const direction = cross >= 0 ? 1 : -1;
    const radius = Math.hypot(c.x - b.x, c.y - b.y);
    const angle = ab + direction * targetRadians;
    c.x = b.x + Math.cos(angle) * radius;
    c.y = b.y + Math.sin(angle) * radius;
  }

  const downstream: Record<number, number[]> = {
    13: [15, 17, 19, 21],
    14: [16, 18, 20, 22],
    15: [17, 19, 21],
    16: [18, 20, 22],
    27: [29, 31],
    28: [30, 32],
  };
  const delta = { x: c.x - old.x, y: c.y - old.y, z: c.z - old.z };
  for (const index of downstream[cIndex] ?? []) {
    const point = next[index];
    if (!point) continue;
    point.x += delta.x;
    point.y += delta.y;
    point.z += delta.z;
  }
  return next;
}

function guideRange(exercise: Exercise, target: number): [number, number] {
  if (exercise.id === 'knee') return [90, target];
  if (exercise.id === 'elbow') return [55, target];
  if (exercise.id === 'shoulder') return [35, target];
  return [exercise.repThresholds?.[0] ?? 60, target];
}

function referenceFrame(
  frame: Frame | undefined,
  exercise: Exercise,
  side: Session['side'],
  target: number,
  observedRange: [number, number],
) {
  if (!frame) return undefined;
  const [guideMin, guideMax] = guideRange(exercise, target);
  const [observedMin, observedMax] = observedRange;
  const phase =
    frame.angle == null
      ? 1
      : Math.max(
          0,
          Math.min(1, (frame.angle - observedMin) / Math.max(1, observedMax - observedMin)),
        );
  const guideAngle = guideMin + (guideMax - guideMin) * phase;
  const joint = exercise.joints[side];
  let landmarks = correctedPoints(frame.landmarks, joint, guideAngle, false);
  let worldLandmarks = frame.worldLandmarks
    ? correctedPoints(frame.worldLandmarks, joint, guideAngle, true)
    : undefined;
  if (exercise.id === 'knee') {
    const supportJoint: [number, number, number] = side === 'left' ? [24, 26, 28] : [23, 25, 27];
    landmarks = correctedPoints(landmarks, supportJoint, 175, false);
    worldLandmarks = worldLandmarks
      ? correctedPoints(worldLandmarks, supportJoint, 175, true)
      : undefined;
  }
  return {
    ...frame,
    angle: guideAngle,
    landmarks,
    worldLandmarks,
  };
}

function clock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${rest}`;
}

export default function PoseKeyframeReview({
  frames,
  duration: recordedDuration,
  side,
  mirrored = false,
  exercise,
  targetAngle,
}: {
  frames: Frame[];
  duration: number;
  side: Session['side'];
  mirrored?: boolean;
  exercise: Exercise;
  targetAngle?: number;
}) {
  const duration = Math.max(recordedDuration, frames.at(-1)?.time ?? 0, 0.1);
  const [compare, setCompare] = useState(false);
  const observedRange = useMemo((): [number, number] => {
    const angles = frames.flatMap((frame) => (frame.angle === null ? [] : [frame.angle]));
    return angles.length ? [Math.min(...angles), Math.max(...angles)] : [0, 180];
  }, [frames]);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<PoseAvatarView>('angle');
  const [viewResetKey, setViewResetKey] = useState(0);
  const target = targetAngle;
  const index = useMemo(() => {
    let found = 0;
    for (let next = 1; next < frames.length && frames[next].time <= playhead; next += 1)
      found = next;
    return found;
  }, [frames, playhead]);
  const sample = frames[index];
  const frame = sample && Math.abs(sample.time - playhead) <= 0.2 ? sample : undefined;
  const guide = useMemo(
    () =>
      compare && target !== undefined
        ? referenceFrame(frame, exercise, side, target, observedRange)
        : undefined,
    [frame, exercise, side, target, observedRange, compare],
  );

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    let animation = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.25) * speed;
      last = now;
      setPlayhead((time) => {
        const next = Math.min(duration, time + delta);
        return next;
      });
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [playing, speed, duration, frames.length]);
  useEffect(() => {
    if (playhead >= duration) setPlaying(false);
  }, [playhead, duration]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);

  const seek = (next: number) => {
    setPlayhead(Math.max(0, Math.min(duration, next)));
  };
  const togglePlayback = () => {
    if (playhead >= duration - 0.02) setPlayhead(0);
    setPlaying((value) => !value);
  };

  if (!frames.length) return <p className="notice">3D로 재생할 랜드마크 프레임이 없습니다.</p>;

  return (
    <section className="pose-keyframe-review">
      <div className="pose-review-toolbar">
        <div>
          <strong>나의 움직임</strong>
          <span>
            {frames.some((frame) => frame.worldLandmarks?.length)
              ? '3D 관절 좌표 기반'
              : '영상 좌표로 재구성'}
          </span>
        </div>
        <div className="pose-view-switch" role="group" aria-label="3D 재생 시점">
          {(['front', 'side', 'back', 'angle'] as PoseAvatarView[]).map((name) => (
            <button
              type="button"
              key={name}
              aria-pressed={view === name}
              className={view === name ? 'selected' : ''}
              onClick={() => {
                setView(name);
                setViewResetKey((value) => value + 1);
              }}
            >
              {{ front: '정면', side: '측면', back: '후면', angle: '사선' }[name]}
            </button>
          ))}
        </div>
      </div>
      <p className="pose-interaction-hint">드래그로 회전 · 두 손가락으로 확대</p>

      {target !== undefined && (
        <button
          className="pose-compare-toggle"
          aria-pressed={compare}
          onClick={() => setCompare((value) => !value)}
        >
          목표 각도와 비교 {compare ? 'ON' : 'OFF'}
        </button>
      )}
      <div className={`pose-review-grid ${compare ? 'is-comparing' : ''}`}>
        <div className="pose-review-panel">
          <div className="pose-panel-label">
            <strong>내 움직임</strong>
            <span>{frame?.angle == null ? '관절 정보 없음' : `${frame.angle.toFixed(0)}°`}</span>
          </div>
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
        </div>
        {compare && target !== undefined && (
          <div className="pose-review-panel reference">
            <div className="pose-panel-label">
              <strong>목표 각도 예시</strong>
              <span>목표 {target}°</span>
            </div>
            <Suspense fallback={<div className="pose-review-loading">목표 모델 준비 중…</div>}>
              <PoseAvatar3D
                frame={guide}
                exercise={exercise}
                side={side}
                mirrored={mirrored}
                view={view}
                viewResetKey={viewResetKey}
                hideChrome
              />
            </Suspense>
          </div>
        )}
      </div>

      <div className="animation-player">
        <input
          className="animation-scrubber"
          aria-label="3D 애니메이션 재생 위치"
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={playhead}
          onChange={(event) => {
            setPlaying(false);
            seek(Number(event.target.value));
          }}
        />
        <div className="animation-transport">
          <button
            type="button"
            aria-label="처음으로"
            onClick={() => {
              setPlaying(false);
              seek(0);
            }}
          >
            <RotateCcw />
          </button>
          <button type="button" aria-label="2초 뒤로" onClick={() => seek(playhead - 2)}>
            <Rewind />
          </button>
          <button
            type="button"
            className="animation-play"
            aria-label={playing ? '일시정지' : '재생'}
            onClick={togglePlayback}
          >
            {playing ? <Pause /> : <Play />}
          </button>
          <button type="button" aria-label="2초 앞으로" onClick={() => seek(playhead + 2)}>
            <FastForward />
          </button>
          <span className="animation-time">
            {clock(playhead)} / {clock(duration)}
          </span>
          <label>
            <span>속도</span>
            <select
              aria-label="3D 애니메이션 재생 속도"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={1.5}>1.5×</option>
              <option value={2}>2×</option>
            </select>
          </label>
        </div>
      </div>

      {compare && (
        <p className="pose-review-help">목표 예시는 입력한 각도로 보정한 참고 애니메이션이에요.</p>
      )}
    </section>
  );
}
