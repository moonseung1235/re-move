import { useEffect, useRef, useState } from 'react';
import { Box, Camera, ChevronRight, ScanLine, Target } from 'lucide-react';
import type { AppData, CaptureRecord, Exercise, Session } from '../../types';
import { exercises, getExercise } from '../../features/exercise-tracking/exercises';
import { matchedExercises } from '../../features/exercise-tracking/personalize';
import { readMedia } from '../../services/local';
import { VideoOverlay } from '../../components/VideoOverlay';
import { duration } from '../../utils/date';
import Modal from '../../components/Modal';
import MotionViewer from '../../components/MotionViewer';

export default function Home({
  data,
  userId,
  onSelect,
  onDetail,
  onCapture,
  onRecords,
  onGoal,
}: {
  data: AppData;
  userId: string;
  onSelect: (exercise: Exercise) => void;
  onDetail: (session: Session) => void;
  onCapture: (capture: CaptureRecord) => void;
  onRecords: () => void;
  onGoal: () => void;
}) {
  const latest = [
    ...data.sessions,
    ...data.captures.filter((c) => !data.sessions.some((s) => s.id === c.id)),
  ].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
  const session = latest ? data.sessions.find((s) => s.id === latest.id) : undefined;
  const capture = latest ? data.captures.find((c) => c.id === latest.id) : undefined;
  const [url, setUrl] = useState(''),
    [loading, setLoading] = useState(false),
    [overlay, setOverlay] = useState(true);
  const [show3D, setShow3D] = useState(false);
  const frames = session?.analysis.frames ?? capture?.frames ?? [];
  const goal = data.preferences.rehabilitation;
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let active = true,
      objectUrl = '';
    setUrl('');
    setOverlay(true);
    setShow3D(false);
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
  const start = () => onSelect(matchedExercises(data.symptoms!)[0] ?? exercises[0]);
  const detail = () => {
    video.current?.pause();
    if (session) onDetail(session);
    else if (capture) onCapture(capture);
    else start();
  };
  const ex = latest ? getExercise(latest.exerciseId) : undefined;
  return (
    <div className="ascend-home">
      <div className="ascend-section-title latest-heading">
        <h1>최근 촬영</h1>
        <button className="text-button" onClick={onRecords}>
          전체 보기
        </button>
      </div>
      <section className="ascend-latest" aria-label="가장 최근 운동 영상 분석">
        <div className={`ascend-video-hero ${url ? 'has-video' : 'empty'}`}>
          {url && ex ? (
            <VideoOverlay
              url={url}
              exercise={ex}
              side={latest.side}
              frames={overlay ? (session?.analysis.frames ?? capture?.frames ?? []) : []}
              videoRef={video}
              mirrored={latest.mirrored}
            />
          ) : (
            <div className="ascend-video-empty">
              <ScanLine size={45} />
              <h2>
                {loading
                  ? '영상을 불러오고 있어요'
                  : latest
                    ? '이 기기에 원본 영상이 없어요'
                    : '나의 첫 움직임을 기록해요'}
              </h2>
              <p>
                {latest
                  ? '분석 결과와 기록은 아래에서 확인할 수 있어요.'
                  : '운동을 고르고 촬영하면 관절과 각도를 볼 수 있어요.'}
              </p>
              {!latest && (
                <button className="primary" onClick={start}>
                  <Camera size={19} /> 촬영 시작
                </button>
              )}
            </div>
          )}
          {latest && ex && (
            <>
              <span className="ascend-video-chip">
                <i />
                {ex.name} · {latest.cameraDirection}
              </span>
              <span className="ascend-video-time">{duration(latest.duration)}</span>
            </>
          )}
        </div>
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
          {session ? '분석 결과 보기' : capture ? '분석 · 공유하기' : '운동 촬영하기'}
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
        {latest && frames.some((frame) => frame.landmarks.some(Boolean)) && (
          <button
            className="secondary full-width home-3d-button"
            onClick={() => {
              video.current?.pause();
              setShow3D(true);
            }}
          >
            <Box size={18} /> 3D 동작 보기
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
      {show3D && latest && ex && (
        <Modal title="3D 동작" onClose={() => setShow3D(false)}>
          <MotionViewer
            key={latest.id}
            initialView="3d"
            url={url}
            exercise={ex}
            side={latest.side}
            frames={frames}
            duration={latest.duration}
            mirrored={latest.mirrored}
            targetAngle={
              goal?.targetExerciseId === latest.exerciseId && goal.side === latest.side
                ? goal.targetAngle
                : undefined
            }
          />
        </Modal>
      )}
      {!data.preferences.rehabilitation && (
        <button className="ascend-goal-prompt" onClick={onGoal}>
          <Target size={17} />
          <span>나에게 맞는 활동 목표 설정</span>
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
