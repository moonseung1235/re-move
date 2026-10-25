import { useState } from 'react';
import { Camera, SlidersHorizontal } from 'lucide-react';
import type { CaptureRecord, Session } from '../../types';
import { exercises, getExercise } from '../../features/exercise-tracking/exercises';
import { previousSession } from '../../features/record-comparison/compare';
import SessionThumbnail from '../../components/SessionThumbnail';
import { duration } from '../../utils/date';
import { dateKey, dateLabel, recentComparable, ScreenHeading, Sparkline } from './shared';
import LatestRecording from './LatestRecording';

export default function Records({
  sessions,
  captures,
  onDetail,
  onCapture,
  onStart,
  userId,
}: {
  sessions: Session[];
  captures: CaptureRecord[];
  onDetail: (session: Session) => void;
  onCapture: (capture: CaptureRecord) => void;
  onStart: () => void;
  userId: string;
}) {
  const [filter, setFilter] = useState('all'),
    [options, setOptions] = useState(false),
    [order, setOrder] = useState('new'),
    [side, setSide] = useState('all');
  const matches = (item: Session | CaptureRecord) =>
    (filter === 'all' || item.exerciseId === filter) && (side === 'all' || item.side === side);
  const all = [...sessions, ...captures.filter((c) => !sessions.some((s) => s.id === c.id))]
    .filter(matches)
    .sort((a, b) =>
      order === 'new'
        ? b.recordedAt.localeCompare(a.recordedAt)
        : a.recordedAt.localeCompare(b.recordedAt),
    );
  const measured = [...sessions]
    .filter(matches)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const current = measured[0],
    previous = current ? previousSession(current, sessions) : undefined;
  const groups = [...new Set(all.map((item) => dateKey(item.recordedAt)))];
  return (
    <div className="ascend-records">
      <div className="ascend-heading-row">
        <ScreenHeading title="내 기록" />
        <button
          className="ascend-round-button"
          aria-label="기록 필터"
          aria-expanded={options}
          onClick={() => setOptions((v) => !v)}
        >
          <SlidersHorizontal size={21} />
        </button>
      </div>
      <div className="ascend-pills record-filters">
        {[{ id: 'all', bodyPart: '전체' }, ...exercises].map((ex) => (
          <button
            key={ex.id}
            className={filter === ex.id ? 'selected' : ''}
            aria-pressed={filter === ex.id}
            onClick={() => setFilter(ex.id)}
          >
            {ex.bodyPart}
          </button>
        ))}
      </div>
      {options && (
        <section className="ascend-card record-options">
          <label>
            정렬
            <select value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="new">최신순</option>
              <option value="old">오래된 순</option>
            </select>
          </label>
          <label>
            측정할 쪽
            <select value={side} onChange={(e) => setSide(e.target.value)}>
              <option value="all">전체</option>
              <option value="left">왼쪽</option>
              <option value="right">오른쪽</option>
            </select>
          </label>
        </section>
      )}
      <LatestRecording
        userId={userId}
        sessions={measured}
        captures={captures.filter(matches)}
        onDetail={onDetail}
        onCapture={onCapture}
      />
      <section className="ascend-card records-trend-card">
        <div>
          <p>
            {current ? `${getExercise(current.exerciseId).bodyPart} 최대 각도` : '움직임의 변화'}{' '}
            {current && previous && (
              <span className="delta-pill">
                {current.analysis.max - previous.analysis.max > 0 ? '+' : ''}
                {(current.analysis.max - previous.analysis.max).toFixed(0)}°
              </span>
            )}
          </p>
          <strong>{current ? `${current.analysis.max.toFixed(0)}°` : '—'}</strong>
          <small>
            {previous
              ? `지난 기록 ${previous.analysis.max.toFixed(0)}° · ${dateLabel(previous.recordedAt)}`
              : '기록이 쌓이면 변화를 비교할 수 있어요.'}
          </small>
        </div>
        <Sparkline
          values={current ? recentComparable(current, sessions).map((s) => s.analysis.max) : []}
          label="최대 각도 변화"
        />
      </section>
      {groups.length ? (
        groups.map((key) => (
          <section key={key} className="ascend-record-group">
            <h2>
              {key === dateKey(new Date()) ? '오늘 · ' : ''}
              {dateLabel(all.find((item) => dateKey(item.recordedAt) === key)!.recordedAt)}
            </h2>
            {all
              .filter((item) => dateKey(item.recordedAt) === key)
              .map((item) => {
                const session = sessions.find((s) => s.id === item.id),
                  ex = getExercise(item.exerciseId);
                return (
                  <button
                    key={item.id}
                    className="ascend-card ascend-record-row"
                    onClick={() => (session ? onDetail(session) : onCapture(item as CaptureRecord))}
                  >
                    <SessionThumbnail session={item} userId={userId} />
                    <div>
                      <h3>
                        {ex.name} · {item.cameraDirection}
                      </h3>
                      <p>
                        {ex.bodyPart} · {item.side === 'left' ? '왼쪽' : '오른쪽'} ·{' '}
                        {session
                          ? `최대 ${session.analysis.max.toFixed(0)}°${session.analysis.repetitions !== null ? ` · ${session.analysis.repetitions}회` : ''}`
                          : '분석 대기 · 원본 영상'}
                      </p>
                    </div>
                    <time>{duration(item.duration)}</time>
                  </button>
                );
              })}
          </section>
        ))
      ) : (
        <section className="ascend-card empty-state">
          <Camera size={32} />
          <h2>첫 기록을 기다리고 있어요</h2>
          <p>나의 움직임을 영상으로 남겨 보세요.</p>
          <button className="primary" onClick={onStart}>
            운동 촬영하기
          </button>
        </section>
      )}
    </div>
  );
}
