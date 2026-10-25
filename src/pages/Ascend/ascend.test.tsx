// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { RehabGoal, Session } from '../../types';
import Feedback from './Feedback';
import GoalSettings from './GoalSettings';
import { weeklyCount } from './shared';
import { cloudPreferences } from '../../services/settings';
vi.mock('../../services/local', () => ({ readMedia: vi.fn().mockResolvedValue(undefined) }));
afterEach(cleanup);
const previous: Session = {
  id: 'previous',
  exerciseId: 'knee',
  recordedAt: '2026-10-22T09:00:00+09:00',
  duration: 26,
  side: 'right',
  cameraDirection: '측면',
  version: '2d-projected-v1',
  analysis: {
    min: 82,
    max: 164,
    range: 82,
    validRatio: 1,
    validFrames: 10,
    totalFrames: 10,
    repetitions: 8,
    frames: [],
  },
};
const current: Session = {
  ...previous,
  id: 'current',
  recordedAt: '2026-10-24T09:00:00+09:00',
  duration: 24,
  analysis: { ...previous.analysis, min: 78, max: 168, range: 90 },
};
const goal: RehabGoal = {
  id: 'goal',
  condition: 'test-only',
  exerciseIds: ['knee'],
  weekdays: [1, 2, 3, 4, 5],
  repetitions: 8,
  targetAngle: 175,
  targetExerciseId: 'knee',
  side: 'right',
  updatedAt: '2026-10-24',
  attachment: {
    id: 'private-file',
    name: 'private-diagnosis.pdf',
    type: 'application/pdf',
    size: 5,
  },
};

it('compares only matching recordings and calculates real feedback differences', () => {
  render(
    <Feedback
      session={current}
      sessions={[
        previous,
        { ...previous, id: 'other-side', side: 'left', analysis: { ...previous.analysis, max: 1 } },
        current,
      ]}
      userId="test"
      busy={false}
      goal={goal}
      onBack={vi.fn()}
      onRecords={vi.fn()}
      onDelete={vi.fn()}
      onShare={vi.fn()}
      onRemoveVideo={vi.fn()}
    />,
  );
  const rows = screen.getAllByRole('row');
  expect(within(rows[1]).getByText('−4°'.replace('−', '-'))).toBeDefined();
  expect(within(rows[2]).getByText('+4°')).toBeDefined();
  expect(within(rows[3]).getByText('+8°')).toBeDefined();
  expect(screen.getByText('움직임 범위가 이전보다 8° 넓어졌어요.')).toBeDefined();
});
it('does not invent a previous measurement when only one recording exists', () => {
  render(
    <Feedback
      session={current}
      sessions={[current]}
      userId="test"
      busy={false}
      onBack={vi.fn()}
      onRecords={vi.fn()}
      onDelete={vi.fn()}
      onShare={vi.fn()}
      onRemoveVideo={vi.fn()}
    />,
  );
  expect(screen.getByText('첫 기록을 남겼어요.')).toBeDefined();
  expect(screen.queryByText('+8°')).toBeNull();
});
it('rejects empty weekly goals and preserves valid selections', async () => {
  const user = userEvent.setup(),
    save = vi.fn();
  render(
    <GoalSettings
      rehabilitation={goal}
      symptoms={null}
      sessions={[]}
      busy={false}
      onClose={vi.fn()}
      onSave={save}
    />,
  );
  for (const label of ['월', '화', '수', '목', '금'])
    await user.click(screen.getByRole('button', { name: `${label}요일` }));
  await user.click(screen.getByRole('button', { name: '저장하기' }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('요일');
  await user.click(screen.getByRole('button', { name: '수요일' }));
  await user.click(screen.getByRole('button', { name: '저장하기' }));
  expect(save.mock.calls[0][1].weekdays).toEqual([3]);
});
it('counts unique activity days and excludes other exercises and other weeks', () => {
  expect(
    weeklyCount(
      [
        current,
        { ...current, id: 'same-day' },
        { ...previous, exerciseId: 'shoulder' },
        previous,
        { ...current, id: 'old', recordedAt: '2026-10-17T10:00:00+09:00' },
      ],
      goal,
      new Date('2026-10-24T12:00:00+09:00'),
    ),
  ).toBe(2);
});
it('never sends diagnosis attachments or filenames in cloud preferences', () => {
  const cleaned = cloudPreferences({
    saveOriginal: true,
    rehabilitation: goal,
    following: ['user-2'],
  });
  expect(cleaned.rehabilitation?.attachment).toBeUndefined();
  expect(JSON.stringify(cleaned)).not.toContain('private-diagnosis');
  expect(cleaned.rehabilitation?.targetAngle).toBe(175);
  expect(cleaned.following).toEqual(['user-2']);
  expect(goal.attachment?.name).toBe('private-diagnosis.pdf');
});
