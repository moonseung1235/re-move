import { Camera, ChevronRight, ScanLine, Target } from 'lucide-react';
import type { AppData, Exercise } from '../../types';
import { exercises } from '../../features/exercise-tracking/exercises';
import { matchedExercises } from '../../features/exercise-tracking/personalize';

export default function Home({
  data,
  onSelect,
  onGoal,
}: {
  data: AppData;
  onSelect: (exercise: Exercise) => void;
  onGoal: () => void;
}) {
  const start = () =>
    onSelect((data.symptoms ? matchedExercises(data.symptoms)[0] : undefined) ?? exercises[0]);
  return (
    <div className="ascend-home analysis-home">
      <div className="ascend-section-title latest-heading">
        <h1>운동 분석</h1>
      </div>
      <section className="analysis-start-card">
        <div className="analysis-start-symbol">
          <ScanLine size={52} strokeWidth={1.4} />
        </div>
        <h2>나의 움직임을 기록해요</h2>
        <p>운동을 선택하고 촬영을 시작해 보세요.</p>
        <button className="primary full-width" onClick={start}>
          <Camera size={20} /> 분석하기 <ChevronRight size={20} />
        </button>
      </section>
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
