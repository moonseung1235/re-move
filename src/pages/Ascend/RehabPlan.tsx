import { useState } from 'react';
import type { RehabGoal, Session } from '../../types';
import { getExercise } from '../../features/exercise-tracking/exercises';
import { ScreenHeading } from './shared';

export default function RehabPlan({
  goal,
  sessions,
  busy,
  onBack,
  onEdit,
  onApply,
  onStart,
}: {
  goal?: RehabGoal;
  sessions: Session[];
  busy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onApply: (notes: string) => void;
  onStart: () => void;
}) {
  const [notes, setNotes] = useState(goal?.requestNotes ?? '');
  const current = goal
    ? [...sessions]
        .filter((s) => s.exerciseId === goal.targetExerciseId && s.side === goal.side)
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]
    : undefined;
  const week = goal?.startedAt
    ? Math.max(
        1,
        Math.floor((Date.now() - new Date(goal.startedAt).getTime()) / (7 * 86400000)) + 1,
      )
    : 0;
  return (
    <section className="ascend-subpage">
      <ScreenHeading
        title="재활 계획 수립"
        subtitle={
          goal
            ? `${goal.side === 'left' ? '왼쪽' : '오른쪽'} ${getExercise(goal.targetExerciseId).bodyPart} · 나의 참고 계획`
            : '목표를 설정하면 활동 계획을 만들 수 있어요'
        }
        onBack={onBack}
      />
      <div className="ascend-card ascend-metrics">
        <div>
          <span>{goal?.targetExerciseId === 'shoulder' ? '최소 각도' : '굴곡'}</span>
          <strong>{current ? `${current.analysis.min.toFixed(0)}°` : '—'}</strong>
        </div>
        <div>
          <span>{goal?.targetExerciseId === 'shoulder' ? '최대 각도' : '신전'}</span>
          <strong>{current ? `${current.analysis.max.toFixed(0)}°` : '—'}</strong>
        </div>
        <div>
          <span>가동범위</span>
          <strong>{current ? `${current.analysis.range.toFixed(0)}°` : '—'}</strong>
        </div>
      </div>
      <section className="ascend-card">
        <div className="ascend-section-title">
          <h2>단계별 목표</h2>
          <span>{week ? `현재 ${week}주차` : '시작 전'}</span>
        </div>
        <div className="phase-track">
          {[1, 2, 3, 4].map((n) => (
            <i className={week >= n ? 'active' : ''} key={n} />
          ))}
        </div>
        <div className="phase-labels">
          <span>1–2주 꾸준히 기록</span>
          <span>3–4주 움직임 비교</span>
        </div>
      </section>
      <section className="ascend-card">
        <h2>재활 활동</h2>
        {goal ? (
          <table className="ascend-plan-table">
            <thead>
              <tr>
                <th>활동</th>
                <th>빈도</th>
                <th>반복</th>
                <th>목표 각도</th>
              </tr>
            </thead>
            <tbody>
              {goal.activityText ? (
                <tr>
                  <th className="plan-activity-text">{goal.activityText}</th>
                  <td>주 {goal.weekdays.length}일</td>
                  <td>{goal.repetitions}회</td>
                  <td>{goal.targetAngle}°</td>
                </tr>
              ) : (
                goal.exerciseIds.map((id) => (
                  <tr key={id}>
                    <th>
                      {getExercise(id).name}
                      <small> · {getExercise(id).cameraDirection}</small>
                    </th>
                    <td>주 {goal.weekdays.length}일</td>
                    <td>{goal.repetitions}회</td>
                    <td>{id === goal.targetExerciseId ? `${goal.targetAngle}°` : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <button className="secondary full-width" onClick={onEdit}>
            목표 설정하기
          </button>
        )}
      </section>
      <section className="ascend-card">
        <h2>요청 사항</h2>
        <div className="plan-request">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="예: 오전 시간대, 주 3일"
            aria-label="계획 요청 사항"
          />
          <button
            className="secondary"
            disabled={!goal || busy}
            onClick={() => onApply(notes.trim())}
          >
            반영
          </button>
        </div>
      </section>
      <p className="ascend-disclaimer">직접 설정한 참고 계획이에요. 담당 의료진과 상의하세요.</p>
      <button
        className="primary ascend-bottom-action"
        disabled={busy}
        onClick={goal ? onStart : onEdit}
      >
        {goal ? '이 계획으로 시작' : '목표 설정하기'}
      </button>
    </section>
  );
}
