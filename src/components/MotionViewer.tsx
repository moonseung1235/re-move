import { lazy, Suspense, useState } from 'react';
import type { Exercise, Frame, Side } from '../types';
import { VideoOverlay } from './VideoOverlay';

const PoseKeyframeReview = lazy(() => import('./PoseKeyframeReview'));

export default function MotionViewer({
  url,
  exercise,
  side,
  frames,
  duration,
  mirrored = false,
  targetAngle,
  initialView = 'video',
}: {
  url?: string;
  exercise: Exercise;
  side: Side;
  frames: Frame[];
  duration: number;
  mirrored?: boolean;
  targetAngle?: number;
  initialView?: 'video' | '3d';
}) {
  const hasPose = frames.some((frame) => frame.landmarks.some(Boolean));
  const [view, setView] = useState(initialView);
  return (
    <section className="motion-viewer" aria-label="운동 동작 보기">
      <div className="motion-view-switch" role="group" aria-label="동작 표시 방식">
        <button type="button" aria-pressed={view === 'video'} onClick={() => setView('video')}>
          영상
        </button>
        <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>
          3D 동작
        </button>
      </div>
      {view === 'video' ? (
        url ? (
          <VideoOverlay
            url={url}
            exercise={exercise}
            side={side}
            frames={frames}
            mirrored={mirrored}
          />
        ) : (
          <p className="motion-empty">이 기기에 원본 영상이 없어요.</p>
        )
      ) : hasPose ? (
        <Suspense fallback={<div className="pose-review-loading">3D 모델 준비 중…</div>}>
          <PoseKeyframeReview
            frames={frames}
            duration={duration}
            exercise={exercise}
            side={side}
            mirrored={mirrored}
            targetAngle={targetAngle}
          />
        </Suspense>
      ) : (
        <p className="motion-empty">3D로 재생할 관절 정보가 없어요. 영상을 다시 분석해 주세요.</p>
      )}
    </section>
  );
}
