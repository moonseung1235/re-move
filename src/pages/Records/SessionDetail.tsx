import { useEffect, useState } from 'react';
import { LockKeyhole, Trash2, ArrowRight } from 'lucide-react';
import type { Session } from '../../types';
import { readMedia } from '../../services/local';
import { getExercise } from '../../features/exercise-tracking/exercises';
import { RangeChart, TimelineChart } from '../../components/Charts';
import { VideoOverlay } from '../../components/VideoOverlay';
import Modal from '../../components/Modal';
import { duration, formatDate } from '../../utils/date';
import { previousSession } from '../../features/record-comparison/compare';
import ReviewStatus from '../../components/ReviewStatus';
export default function SessionDetail({
  session,
  sessions,
  userId,
  busy,
  onClose,
  onDelete,
  onShare,
  onRemoveVideo,
}: {
  session: Session;
  sessions: Session[];
  userId: string;
  busy: boolean;
  onClose: () => void;
  onDelete: () => void;
  onShare: () => void;
  onRemoveVideo: () => void;
}) {
  const [url, setUrl] = useState(''),
    [confirm, setConfirm] = useState(false);
  const previous = previousSession(session, sessions);
  useEffect(() => {
    let active = true,
      objectUrl = '';
    setUrl('');
    if (session.mediaId)
      readMedia(userId, session.mediaId).then((blob) => {
        if (blob && active) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session.mediaId, userId]);
  return (
    <Modal title={getExercise(session.exerciseId).name} wide onClose={onClose}>
      <p className="form-description">
        {formatDate(session.recordedAt)} · {session.side === 'left' ? '왼쪽' : '오른쪽'} ·{' '}
        {session.cameraDirection} · {duration(session.duration)}
      </p>
      {url ? (
        <VideoOverlay
          url={url}
          exercise={getExercise(session.exerciseId)}
          side={session.side}
          frames={session.analysis.frames}
        />
      ) : (
        <div className="notice">
          <LockKeyhole size={17} /> 원본 영상이 이 브라우저에 보관되어 있지 않습니다. 측정 결과는
          아래에서 확인할 수 있어요.
        </div>
      )}
      <div className="analysis-metrics">
        <div>
          <span>관측 각도 범위</span>
          <strong>{session.analysis.range.toFixed(1)}°</strong>
        </div>
        <div>
          <span>최소 각도</span>
          <strong>{session.analysis.min.toFixed(1)}°</strong>
        </div>
        <div>
          <span>최대 각도</span>
          <strong>{session.analysis.max.toFixed(1)}°</strong>
        </div>
        <div>
          <span>유효 프레임</span>
          <strong>{Math.round(session.analysis.validRatio * 100)}%</strong>
        </div>
      </div>
      <h3>시간별 관절 움직임</h3>
      <ReviewStatus />
      <TimelineChart session={session} />
      <h3>날짜별 관측 각도 범위</h3>
      {previous && (
        <div className="feedback">
          <div>
            <strong>{formatDate(previous.recordedAt)} 기록과 비교</strong>
            <p>
              관측 각도 범위 {previous.analysis.range.toFixed(1)}° →{' '}
              {session.analysis.range.toFixed(1)}° · 차이{' '}
              {(session.analysis.range - previous.analysis.range).toFixed(1)}°<br />
              운동 시간 {duration(previous.duration)} → {duration(session.duration)} · 차이{' '}
              {Math.round(session.duration - previous.duration)}초
            </p>
          </div>
        </div>
      )}
      <RangeChart current={session} sessions={sessions} />
      <p className="notice">
        각도 변화가 의학적 회복을 의미하지는 않습니다. 같은 촬영 방향이어도 거리·높이·가림 등 조건이
        다르면 비교 신뢰도가 낮아질 수 있습니다.
      </p>
      <div className="button-row">
        <button className="primary" onClick={onShare}>
          선택 공유 <ArrowRight size={16} />
        </button>
        {url && (
          <button className="secondary" onClick={onRemoveVideo} disabled={busy}>
            원본 영상만 삭제
          </button>
        )}
        <button className="text-button danger-text" onClick={() => setConfirm(true)}>
          <Trash2 size={16} /> 기록 삭제
        </button>
      </div>
      {confirm && (
        <div className="delete-confirm">
          <span>기록과 기기에 보관한 영상을 삭제할까요?</span>
          <button className="danger-text text-button" disabled={busy} onClick={onDelete}>
            삭제
          </button>
          <button className="text-button" onClick={() => setConfirm(false)}>
            취소
          </button>
        </div>
      )}
    </Modal>
  );
}
