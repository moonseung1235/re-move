import { useRef, useState } from 'react';
import { Minus, Paperclip, Plus, X } from 'lucide-react';
import type { Goal, RehabGoal, Session, SymptomProfile } from '../../types';
import { exercises, getExercise } from '../../features/exercise-tracking/exercises';
import { createId } from '../../utils/id';
import { matchedExercises } from '../../features/exercise-tracking/personalize';
import { Progress, ScreenHeading } from './shared';

export default function GoalSettings({
  goal,
  rehabilitation,
  symptoms,
  sessions,
  busy,
  onClose,
  onSave,
}: {
  goal?: Goal;
  rehabilitation?: RehabGoal;
  symptoms: SymptomProfile | null;
  sessions: Session[];
  busy: boolean;
  onClose: () => void;
  onSave: (goal: Goal, rehabilitation: RehabGoal, attachment?: File) => void;
}) {
  const defaultExerciseId = symptoms ? (matchedExercises(symptoms)[0]?.id ?? 'knee') : 'knee';
  const [condition, setCondition] = useState(rehabilitation?.condition ?? ''),
    [activityText, setActivityText] = useState(
      rehabilitation?.activityText ??
        rehabilitation?.exerciseIds.map((id) => getExercise(id).name).join(', ') ??
        '',
    ),
    [weekdays, setWeekdays] = useState(rehabilitation?.weekdays ?? [1, 2, 3, 4, 5]),
    [repetitions, setRepetitions] = useState(rehabilitation?.repetitions ?? 8),
    [targetAngle, setTargetAngle] = useState(rehabilitation?.targetAngle ?? 175),
    [targetExerciseId, setTargetExerciseId] = useState(
      rehabilitation?.targetExerciseId ?? defaultExerciseId,
    ),
    [side, setSide] = useState<'left' | 'right'>(
      rehabilitation?.side ?? (symptoms?.side === 'right' ? 'right' : 'left'),
    ),
    [attachment, setAttachment] = useState<File>(),
    [keepAttachment, setKeepAttachment] = useState(true),
    [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const current = [...sessions]
    .filter((s) => s.exerciseId === targetExerciseId && s.side === side)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
  return (
    <section className="ascend-subpage goal-settings">
      <ScreenHeading title="목표 설정" onBack={onClose} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!activityText.trim()) {
            setError('재활 활동 종류를 입력해 주세요.');
            return;
          }
          if (!weekdays.length) {
            setError('요일을 하나 이상 선택해 주세요.');
            return;
          }
          const id = rehabilitation?.id ?? goal?.id ?? createId();
          onSave(
            {
              id: goal?.id ?? id,
              title: goal?.title ?? '나의 재활 활동 목표',
              description: condition.trim(),
              status: goal?.status ?? 'active',
              primary: true,
              createdAt: goal?.createdAt ?? new Date().toISOString(),
            },
            {
              id,
              condition: condition.trim(),
              activityText: activityText.trim(),
              exerciseIds: [...new Set([...(rehabilitation?.exerciseIds ?? []), targetExerciseId])],
              weekdays: [...weekdays].sort(),
              repetitions,
              targetAngle,
              targetExerciseId,
              side,
              updatedAt: new Date().toISOString(),
              startedAt: rehabilitation?.startedAt,
              requestNotes: rehabilitation?.requestNotes,
              attachment: keepAttachment ? rehabilitation?.attachment : undefined,
            },
            attachment,
          );
        }}
      >
        <section className="ascend-card diagnosis-card">
          <label className="sr-only" htmlFor="goal-condition">
            병명 또는 재활 상황
          </label>
          <input
            id="goal-condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            maxLength={300}
            placeholder="병명을 입력해요 (예: 무릎 수술 후)"
          />
          <input
            hidden
            ref={fileInput}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            aria-label="진단서 선택"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (
                  file.size > 20 * 1024 * 1024 ||
                  !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)
                ) {
                  setError('PDF 또는 이미지 파일을 20MB 이하로 선택해 주세요.');
                  return;
                }
                setAttachment(file);
                setKeepAttachment(true);
                setError('');
              }
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="diagnosis-attachment"
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip size={21} />
            <span>
              <strong>병원 진단서 첨부</strong>
              <small>선택 · 이 기기에만 저장</small>
            </span>
            <b>{attachment || (keepAttachment && rehabilitation?.attachment) ? '변경' : '추가'}</b>
          </button>
          {(attachment || (keepAttachment && rehabilitation?.attachment)) && (
            <div className="attachment-name">
              <span>{attachment?.name ?? rehabilitation?.attachment?.name}</span>
              <button
                type="button"
                aria-label="진단서 첨부 제외"
                onClick={() => {
                  setAttachment(undefined);
                  setKeepAttachment(false);
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}
        </section>
        <section className="ascend-card">
          <label className="field-label">
            재활 활동 종류
            <textarea
              rows={3}
              maxLength={500}
              value={activityText}
              onChange={(event) => setActivityText(event.target.value)}
              placeholder="예: 걷기, 무릎 굽히기, 스트레칭"
            />
          </label>
        </section>
        <section className="ascend-card">
          <div className="ascend-section-title">
            <h2>이번 주 재활 활동 목표</h2>
            <strong>
              {weekdays.length}
              <small>일</small>
            </strong>
          </div>
          <div className="weekday-options">
            {['월', '화', '수', '목', '금', '토', '일'].map((label, i) => {
              const day = (i + 1) % 7;
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={`${label}요일`}
                  aria-pressed={weekdays.includes(day)}
                  className={weekdays.includes(day) ? 'selected' : ''}
                  onClick={() =>
                    setWeekdays((days) =>
                      days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
                    )
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Progress value={weekdays.length} total={7} label="주간 목표 일수" />
        </section>
        <section className="ascend-card">
          <p className="ascend-label">한 번 재활 활동에서 채울 반복 횟수</p>
          <div className="ascend-pills">
            {[5, 8, 10, 12].map((n) => (
              <button
                type="button"
                key={n}
                aria-pressed={repetitions === n}
                className={repetitions === n ? 'selected' : ''}
                onClick={() => setRepetitions(n)}
              >
                {n}회
              </button>
            ))}
          </div>
          <div className="angle-goal-controls">
            <div>
              <h3>각도 목표</h3>
              <div className="angle-target-select">
                <select
                  aria-label="목표 관절"
                  value={targetExerciseId}
                  onChange={(e) => setTargetExerciseId(e.target.value)}
                >
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.bodyPart}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="목표 측정할 쪽"
                  value={side}
                  onChange={(e) => setSide(e.target.value as 'left' | 'right')}
                >
                  <option value="left">왼쪽</option>
                  <option value="right">오른쪽</option>
                </select>
              </div>
              <small>
                {getExercise(targetExerciseId).bodyPart} · 최대{' '}
                {current ? `(현재 ${current.analysis.max.toFixed(0)}°)` : '(측정 기록 없음)'}
              </small>
            </div>
            <div className="angle-stepper">
              <button
                type="button"
                aria-label="목표 각도 줄이기"
                onClick={() => setTargetAngle((v) => Math.max(0, v - 5))}
              >
                <Minus size={22} />
              </button>
              <output aria-label="목표 각도">
                {targetAngle}
                <small>°</small>
              </output>
              <button
                type="button"
                aria-label="목표 각도 늘리기"
                onClick={() => setTargetAngle((v) => Math.min(180, v + 5))}
              >
                <Plus size={22} />
              </button>
            </div>
          </div>
        </section>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary ascend-bottom-action" disabled={busy}>
          {busy ? '저장 중…' : '저장하기'}
        </button>
      </form>
    </section>
  );
}
