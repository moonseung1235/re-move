import { useEffect, useRef } from 'react';
import type { Exercise, Frame, Side } from '../types';
const connections = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [28, 30],
  [30, 32],
];
export function VideoOverlay({
  url,
  exercise,
  side,
  frames = [],
  videoRef,
  analyzing = false,
}: {
  url: string;
  exercise: Exercise;
  side: Side;
  frames?: Frame[];
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  analyzing?: boolean;
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const index = Math.round(video.currentTime * 10),
          frame = frames[index];
        if (frame && Math.abs(frame.time - video.currentTime) < 0.18) {
          const points = frame.landmarks,
            targets = exercise.joints[side];
          ctx.lineWidth = Math.max(2, canvas.width / 250);
          for (const [a, b] of connections) {
            const p = points[a],
              q = points[b];
            if (!p || !q || p.visibility < 0.65 || q.visibility < 0.65) continue;
            ctx.strokeStyle =
              targets.includes(a) && targets.includes(b) && frame.angle !== null
                ? '#b8ff79'
                : '#69e1ce';
            ctx.beginPath();
            ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
            ctx.lineTo(q.x * canvas.width, q.y * canvas.height);
            ctx.stroke();
          }
          points.forEach((p, i) => {
            if (p.visibility < 0.65) return;
            ctx.fillStyle = targets.includes(i) ? '#c9ff88' : '#fff';
            ctx.beginPath();
            ctx.arc(p.x * canvas.width, p.y * canvas.height, canvas.width / 180, 0, Math.PI * 2);
            ctx.fill();
          });
          if (frame.angle !== null) {
            const b = points[targets[1]];
            ctx.font = `bold ${Math.max(18, canvas.width / 32)}px sans-serif`;
            ctx.fillStyle = '#c9ff88';
            ctx.fillText(
              `${frame.angle.toFixed(1)}°`,
              b.x * canvas.width + 14,
              b.y * canvas.height - 14,
            );
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [frames, exercise, side, ref]);
  return (
    <div className="video-stage">
      <video
        src={url}
        ref={ref}
        playsInline
        controls={!analyzing}
        preload="auto"
        aria-label={`${exercise.name} 분석 영상`}
      />
      <canvas ref={canvasRef} />
      {frames.length > 0 && (
        <span className="video-label">
          <span /> 실제 측정 · MediaPipe
        </span>
      )}
    </div>
  );
}
