import { useState } from 'react';
import {
  Archive,
  CalendarDays,
  ChevronRight,
  Heart,
  List,
  LogOut,
  Paperclip,
  Settings2,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import type { AppData, Preferences } from '../../types';
import { bodyAreas } from '../../features/exercise-tracking/personalize';
import { readMedia } from '../../services/local';
import InstallApp from '../../pwa/InstallApp';
import Modal from '../../components/Modal';
import { Progress, ScreenHeading, weeklyCount } from './shared';

export default function More({
  data,
  local,
  busy,
  userId,
  onSymptoms,
  onNickname,
  onPreferences,
  onGoal,
  onPlan,
  onOwnPosts,
  onAuth,
  onHelp,
  onExport,
  onDeleteRecords,
}: {
  data: AppData;
  local: boolean;
  busy: boolean;
  userId: string;
  onSymptoms: () => void;
  onNickname: (name: string) => void;
  onPreferences: (prefs: Preferences) => void;
  onGoal: () => void;
  onPlan: () => void;
  onOwnPosts: () => void;
  onAuth: () => void;
  onHelp: () => void;
  onExport: () => void;
  onDeleteRecords: () => void;
}) {
  const [nicknameOpen, setNicknameOpen] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [nickname, setNickname] = useState(data.nickname),
    [documentError, setDocumentError] = useState('');
  const goal = data.preferences.rehabilitation,
    days = weeklyCount(data.sessions, goal);
  const part =
    data.symptoms?.areas.map((id) => bodyAreas.find((a) => a.id === id)?.name).join(' · ') ??
    '부위 미설정';
  const direction =
    data.symptoms?.side === 'left'
      ? '왼쪽'
      : data.symptoms?.side === 'right'
        ? '오른쪽'
        : data.symptoms?.side === 'both'
          ? '양쪽'
          : '좌우 미설정';
  async function openDocument() {
    const attachment = goal?.attachment;
    if (!attachment) return;
    try {
      const blob = await readMedia(userId, attachment.id);
      if (!blob) {
        setDocumentError('이 기기에 첨부한 진단서가 없어요.');
        return;
      }
      const url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = attachment.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setDocumentError('첨부파일을 열지 못했어요.');
    }
  }
  return (
    <div className="ascend-more">
      <ScreenHeading title="더보기" />
      <section className="ascend-card ascend-profile-card">
        <div className="profile-identity">
          <span className="avatar">{data.nickname.slice(0, 1).toUpperCase()}</span>
          <div>
            <h2>{data.nickname}</h2>
            <p>
              {part} · {direction} 재활 중
            </p>
          </div>
        </div>
        <div className="progress-label">
          <span>이번 주 운동 목표</span>
          <strong>
            {days} / {goal?.weekdays.length ?? '—'}일
          </strong>
        </div>
        <Progress
          value={goal ? days : 0}
          total={goal?.weekdays.length ?? 7}
          label="이번 주 운동 목표"
        />
      </section>
      <section className="ascend-card settings-menu">
        <button onClick={onSymptoms}>
          <i>
            <Heart size={19} />
          </i>
          <strong>증상 · 부위 수정</strong>
          <small>
            {part} · {direction}
          </small>
          <ChevronRight size={18} />
        </button>
        <button onClick={onGoal}>
          <i>
            <List size={19} />
          </i>
          <strong>운동 목록 재구성</strong>
          <ChevronRight size={18} />
        </button>
        <button onClick={onPlan}>
          <i>
            <CalendarDays size={19} />
          </i>
          <strong>운동 계획</strong>
          <small>{goal ? `주 ${goal.weekdays.length}일` : '목표 설정'}</small>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => setNicknameOpen(true)}>
          <i>
            <UserRound size={19} />
          </i>
          <strong>닉네임 · 목표</strong>
          <ChevronRight size={18} />
        </button>
      </section>
      <section className="ascend-card settings-menu">
        <label className="setting-toggle">
          <i>
            <Archive size={19} />
          </i>
          <strong>원본 영상 보관</strong>
          <input
            type="checkbox"
            aria-label="원본 영상을 이 기기에 보관"
            checked={data.preferences.saveOriginal}
            disabled={busy}
            onChange={(e) => onPreferences({ ...data.preferences, saveOriginal: e.target.checked })}
          />
          <span
            aria-hidden="true"
            className={`ascend-toggle ${data.preferences.saveOriginal ? 'on' : ''}`}
          />
        </label>
        <button onClick={onExport}>
          <i>
            <Upload size={19} />
          </i>
          <strong>기록 내보내기</strong>
          <ChevronRight size={18} />
        </button>
        <button className="danger-text" onClick={() => setDeleteOpen(true)}>
          <i>
            <Trash2 size={19} />
          </i>
          <strong>기록 삭제</strong>
          <ChevronRight size={18} />
        </button>
      </section>
      {goal?.attachment && (
        <section className="ascend-card settings-menu">
          <button onClick={() => void openDocument()}>
            <i>
              <Paperclip size={18} />
            </i>
            <strong>첨부한 진단서</strong>
            <small>이 기기에만 저장</small>
            <ChevronRight size={18} />
          </button>
        </section>
      )}
      {documentError && (
        <p className="error" role="alert">
          {documentError}
        </p>
      )}
      <details className="ascend-extra-settings">
        <summary>
          <Settings2 size={17} /> 앱 관리
        </summary>
        <section className="ascend-card settings-menu">
          <InstallApp row />
          <button onClick={onOwnPosts}>
            <strong>내가 작성한 게시글</strong>
            <ChevronRight size={18} />
          </button>
          <button onClick={onHelp}>
            <strong>ASCEND 이용 안내</strong>
            <ChevronRight size={18} />
          </button>
          <button onClick={onAuth}>
            <LogOut size={18} />
            <strong>{local ? '로그인 / 회원가입' : '로그아웃'}</strong>
            <ChevronRight size={18} />
          </button>
        </section>
      </details>
      <p className="ascend-version">ASCEND v0.1 · 영상은 이 기기에 저장돼요</p>
      {nicknameOpen && (
        <Modal title="닉네임 · 목표" onClose={() => setNicknameOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (nickname.trim()) {
                onNickname(nickname.trim());
                setNicknameOpen(false);
              }
            }}
          >
            <label className="field-label">
              닉네임
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                maxLength={20}
              />
            </label>
            <button className="primary full-width" disabled={busy}>
              닉네임 저장
            </button>
          </form>
          <button
            className="secondary full-width"
            onClick={() => {
              setNicknameOpen(false);
              onGoal();
            }}
          >
            재활 활동 목표 설정
          </button>
        </Modal>
      )}
      {deleteOpen && (
        <Modal title="기록 삭제" onClose={() => setDeleteOpen(false)}>
          <p>
            모든 운동 기록과 이 기기에 보관한 원본 영상을 삭제할까요? 되돌릴 수 없으며, 커뮤니티
            게시글은 별도로 관리됩니다.
          </p>
          <div className="button-row">
            <button className="secondary" onClick={() => setDeleteOpen(false)}>
              취소
            </button>
            <button
              className="primary danger-button"
              disabled={busy}
              onClick={() => {
                onDeleteRecords();
                setDeleteOpen(false);
              }}
            >
              모든 기록 삭제
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
