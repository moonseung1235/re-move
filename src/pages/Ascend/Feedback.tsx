import { useEffect, useState } from 'react';
import { ChevronRight, Share2, Trash2 } from 'lucide-react';
import type { RehabGoal, Session } from '../../types';
import { getExercise } from '../../features/exercise-tracking/exercises';
import { previousSession } from '../../features/record-comparison/compare';
import { readMedia } from '../../services/local';
import MotionViewer from '../../components/MotionViewer';
import {
  dateLabel,
  Progress,
  recentComparable,
  ScreenHeading,
  Sparkline,
  weeklyCount,
} from './shared';

export default function Feedback({
  session,
  sessions,
  userId,
  busy,
  goal,
  onBack,
  onRecords,
  onDelete,
  onShare,
  onRemoveVideo,
}: {
  session: Session;
  sessions: Session[];
  userId: string;
  busy: boolean;
  goal?: RehabGoal;
  onBack: () => void;
  onRecords: () => void;
  onDelete: () => void;
  onShare: () => void;
  onRemoveVideo: () => void;
}) {
  const [details, setDetails] = useState(false),
    [confirm, setConfirm] = useState(false),
    [url, setUrl] = useState('');
  const previous = previousSession(session, sessions),
    ex = getExercise(session.exerciseId);
  useEffect(() => {
    let active = true,
      objectUrl = '';
    setUrl('');
    if (session.mediaId)
      readMedia(userId, session.mediaId)
        .then((blob) => {
          if (blob && active) {
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
          }
        })
        .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session.mediaId, userId]);
  const maximumLabel = session.exerciseId === 'shoulder' ? '최대 각도' : '신전 각도';
  const rows = [
    {
      name: session.exerciseId === 'shoulder' ? '최소 각도' : '굴곡 각도',
      value: session.analysis.min,
      old: previous?.analysis.min,
      unit: '°',
    },
    { name: maximumLabel, value: session.analysis.max, old: previous?.analysis.max, unit: '°' },
    {
      name: '움직임 범위',
      value: session.analysis.range,
      old: previous?.analysis.range,
      unit: '°',
    },
    {
      name: '반복 횟수',
      value: session.analysis.repetitions,
      old: previous?.analysis.repetitions,
      unit: '회',
    },
  ];
  const target =
    goal?.targetExerciseId === session.exerciseId && goal.side === session.side
      ? goal.targetAngle
      : undefined;
  const days = weeklyCount(sessions, goal),
    delta = previous ? session.analysis.range - previous.analysis.range : undefined;
  return (
    <section className="ascend-subpage feedback-page">
      <ScreenHeading
        title="피드백"
        onBack={onBack}
        subtitle={`${ex.name} · ${session.cameraDirection} · ${session.side === 'left' ? '왼쪽' : '오른쪽'} ${ex.bodyPart} · ${dateLabel(session.recordedAt)}`}
      />
      <section className="ascend-card">
        <h2>이전 기록과 비교</h2>
        <table className="feedback-table">
          <thead>
            <tr>
              <th>지표</th>
              <th>이번 기록</th>
              <th>{previous ? dateLabel(previous.recordedAt) : '이전 기록'}</th>
              <th>변화</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const diff =
                row.value !== null && row.old !== null && row.old !== undefined
                  ? row.value - row.old
                  : undefined;
              return (
                <tr key={row.name}>
                  <th>{row.name}</th>
                  <td>{row.value === null ? '—' : `${row.value.toFixed(0)}${row.unit}`}</td>
                  <td>
                    {row.old === null || row.old === undefined
                      ? '—'
                      : `${row.old.toFixed(0)}${row.unit}`}
                  </td>
                  <td>
                    <span
                      className={`delta-pill ${diff === undefined || diff === 0 ? 'neutral' : ''}`}
                    >
                      {diff === undefined
                        ? '—'
                        : `${diff > 0 ? '+' : ''}${diff.toFixed(0)}${row.unit}`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className="ascend-card">
        <h2>목표 대비</h2>
        <div className="progress-label">
          <strong>{maximumLabel}</strong>
          <span>
            {session.analysis.max.toFixed(0)}° /{' '}
            {target !== undefined ? `${target}°` : '목표 미설정'}
          </span>
        </div>
        <Progress
          label="각도 목표 대비"
          value={target !== undefined ? session.analysis.max : 0}
          total={target ?? 180}
        />
        <div className="progress-label">
          <strong>이번 주 재활 활동</strong>
          <span>
            {days}일 / {goal ? `${goal.weekdays.length}일` : '목표 미설정'}
          </span>
        </div>
        <Progress
          label="이번 주 재활 활동"
          value={goal ? days : 0}
          total={goal?.weekdays.length ?? 7}
        />
      </section>
      <section className="ascend-card feedback-trend">
        <div>
          <p>{maximumLabel} 추이(최근 5회)</p>
          <strong>
            {delta === undefined
              ? '첫 기록을 남겼어요.'
              : `움직임 범위가 이전보다 ${Math.abs(delta).toFixed(0)}° ${delta >= 0 ? '넓어졌어요.' : '좁아졌어요.'}`}
          </strong>
        </div>
        <Sparkline
          values={recentComparable(session, sessions).map((s) => s.analysis.max)}
          label={`최근 ${maximumLabel} 추이`}
        />
      </section>
      <p className="ascend-disclaimer">측정값은 2D 영상 기준 참고용이며 진단이 아니에요.</p>
      <button className="primary full-width" onClick={() => setDetails((value) => !value)}>
        기록에서 자세히 보기 <ChevronRight size={18} />
      </button>
      {details && (
        <section className="ascend-card detailed-record">
          <MotionViewer
            key={session.id}
            url={url}
            exercise={ex}
            side={session.side}
            frames={session.analysis.frames}
            duration={session.duration}
            mirrored={session.mirrored}
            targetAngle={target}
          />
          <p className="ascend-label">
            유효 프레임 {Math.round(session.analysis.validRatio * 100)}% · {session.version}
          </p>
          <div className="button-row">
            <button className="secondary" onClick={onShare}>
              <Share2 size={17} /> 선택 공유
            </button>
            {url && (
              <button className="text-button" onClick={onRemoveVideo} disabled={busy}>
                원본 영상만 삭제
              </button>
            )}
            <button className="text-button danger-text" onClick={() => setConfirm(true)}>
              <Trash2 size={16} /> 기록 삭제
            </button>
          </div>
          {confirm && (
            <div className="delete-confirm">
              <p>기록과 이 기기의 원본 영상을 삭제할까요?</p>
              <button className="text-button danger-text" onClick={onDelete} disabled={busy}>
                삭제
              </button>
              <button className="text-button" onClick={() => setConfirm(false)}>
                취소
              </button>
            </div>
          )}
        </section>
      )}
      <button className="text-button feedback-all-records" onClick={onRecords}>
        전체 기록 보기
      </button>
    </section>
  );
}
