import { useEffect, useRef } from 'react';
import type { Exercise, Frame, Side } from '../types';
import { drawPose } from '../features/pose-analysis/draw';
import { frameAtTime } from '../features/pose-analysis/frameAtTime';
export function VideoOverlay({
  url,
  exercise,
  side,
  frames = [],
  videoRef,
  analyzing = false,
  mirrored = false,
  controls,
}: {
  url: string;
  exercise: Exercise;
  side: Side;
  frames?: Frame[];
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  analyzing?: boolean;
  mirrored?: boolean;
  controls?: boolean;
}) {
  const localRef = useRef<HTMLVideoElement>(null),
    canvasRef = useRef<HTMLCanvasElement>(null);
  const ref = videoRef ?? localRef;
  useEffect(() => {
    let raf: number;
    const draw = () => {
      const video = ref.current,
        canvas = canvasRef.current;
      if (video && canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const frame = frameAtTime(frames, video.currentTime);
        drawPose(ctx, frame, exercise, side, {
          width: canvas.width,
          height: canvas.height,
          sourceWidth: canvas.width,
          sourceHeight: canvas.height,
          fit: 'contain',
          mirrored,
        });
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [frames, exercise, side, ref, mirrored]);
  return (
    <div className="video-stage">
      <video
        src={url}
        ref={ref}
        className={mirrored ? 'mirrored' : ''}
        playsInline
        controls={controls ?? !analyzing}
        preload="auto"
        aria-label={`${exercise.name} 분석 영상`}
      />
      <canvas ref={canvasRef} />
      {frames.length > 0 && (
        <span className="video-label">
          <span /> MEDIAPIPE POSE
        </span>
      )}
    </div>
  );
}
