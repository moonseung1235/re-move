import { ArrowLeft } from 'lucide-react';
import type { RehabGoal, Session } from '../../types';
import { comparable } from '../../features/record-comparison/compare';

export function ScreenHeading({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  return (
    <header className="ascend-page-heading">
      {onBack && (
        <button className="ascend-back" aria-label="이전 화면" onClick={onBack}>
          <ArrowLeft size={23} />
        </button>
      )}
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </header>
  );
}
export function dateKey(value: string | Date) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
export function dateLabel(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
export function weeklyCount(sessions: Session[], goal?: RehabGoal, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return new Set(
    sessions
      .filter(
        (s) =>
          new Date(s.recordedAt) >= start &&
          new Date(s.recordedAt) < end &&
          (!goal || goal.exerciseIds.includes(s.exerciseId)),
      )
      .map((s) => dateKey(s.recordedAt)),
  ).size;
}
export function recentComparable(current: Session, sessions: Session[]) {
  return sessions
    .filter((s) => comparable(s, current) && s.recordedAt <= current.recordedAt)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .slice(-5);
}
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (!values.length) return <div className="ascend-chart-empty">기록이 쌓이면 변화가 보여요</div>;
  const low = Math.min(...values) - 5,
    high = Math.max(...values) + 5;
  const coords = values.map((v, i) => [
    12 + (i / Math.max(1, values.length - 1)) * 190,
    62 - ((v - low) / (high - low)) * 48,
  ]);
  return (
    <svg className="ascend-sparkline" viewBox="0 0 216 76" role="img" aria-label={label}>
      <polyline
        points={coords.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={coords.at(-1)![0]}
        cy={coords.at(-1)![1]}
        r="6"
        fill="#e7b637"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
export function Progress({ value, total, label }: { value: number; total: number; label: string }) {
  return (
    <div
      className="ascend-progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={Math.max(total, value, 1)}
    >
      <span style={{ width: `${Math.min(100, total > 0 ? (value / total) * 100 : 0)}%` }} />
    </div>
  );
}
