import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { CaptureRecord, Session } from '../../types';
import { getExercise } from '../../features/exercise-tracking/exercises';
import { readMedia } from '../../services/local';
import RecordingComparison from '../../components/RecordingComparison';

export default function LatestRecording({
  sessions,
  captures,
  userId,
  onDetail,
  onCapture,
}: {
  sessions: Session[];
  captures: CaptureRecord[];
  userId: string;
  onDetail: (session: Session) => void;
  onCapture: (capture: CaptureRecord) => void;
}) {
  const latest = [
    ...sessions,
    ...captures.filter((c) => !sessions.some((s) => s.id === c.id)),
  ].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
  const session = latest ? sessions.find((s) => s.id === latest.id) : undefined;
  const capture = latest ? captures.find((c) => c.id === latest.id) : undefined;
  const [url, setUrl] = useState(''),
    [loading, setLoading] = useState(false),
    [overlay, setOverlay] = useState(true);
  const frames = session?.analysis.frames ?? capture?.frames ?? [];
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let active = true,
      objectUrl = '';
    setUrl('');
    setOverlay(true);
    setLoading(!!latest?.mediaId);
    if (latest?.mediaId)
      readMedia(userId, latest.mediaId)
        .then((blob) => {
          if (blob && active) {
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [latest?.id, latest?.mediaId, userId]);
  const detail = () => {
    video.current?.pause();
    if (session) onDetail(session);
    else if (capture) onCapture(capture);
  };
  const ex = latest ? getExercise(latest.exerciseId) : undefined;
  if (!latest || !ex) return null;
  return (
    <div className="latest-recording">
      <div className="ascend-section-title latest-heading">
        <h2>최근 촬영</h2>
      </div>
      <section className="ascend-latest" aria-label="가장 최근 운동 영상 분석">
        <RecordingComparison
          key={latest.id}
          url={url}
          loading={loading}
          exercise={ex}
          side={latest.side}
          frames={frames}
          duration={latest.duration}
          overlay={overlay}
          videoRef={video}
          mirrored={latest.mirrored}
        />
        <div className="ascend-metrics ascend-card">
          <div>
            <span>최소 각도</span>
            <strong>{session ? `${session.analysis.min.toFixed(0)}°` : '—'}</strong>
          </div>
          <div>
            <span>최대 각도</span>
            <strong>{session ? `${session.analysis.max.toFixed(0)}°` : '—'}</strong>
          </div>
          <div>
            <span>반복</span>
            <strong>
              {session?.analysis.repetitions !== null && session?.analysis.repetitions !== undefined
                ? `${session.analysis.repetitions}회`
                : '—'}
            </strong>
          </div>
        </div>
        <button className="primary full-width home-analysis-button" onClick={detail}>
          {session ? '분석 결과 보기' : '분석 · 공유하기'}
          <ChevronRight size={21} />
        </button>
        {url && (
          <button
            className="ascend-overlay-switch"
            role="switch"
            aria-label="분석 표시"
            aria-checked={overlay}
            onClick={() => setOverlay((v) => !v)}
          >
            관절 표시 {overlay ? 'ON' : 'OFF'}
          </button>
        )}
        {capture && !session && (
          <p className="ascend-disclaimer">
            {capture.status === 'failed'
              ? '분석을 다시 확인할 수 있어요. 원본 영상은 보관되어 있어요.'
              : '분석 대기 중 · 영상을 열어 분석을 이어갈 수 있어요.'}
          </p>
        )}
      </section>
    </div>
  );
}
