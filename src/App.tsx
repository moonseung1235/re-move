import InstallApp from './pwa/InstallApp';
import CameraExercisePicker from './components/CameraExercisePicker';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Camera,
  Check,
  CalendarDays,
  MessageCircle,
  Home,
  MoreHorizontal,
  Users,
  X,
} from 'lucide-react';
import type {
  AppData,
  CaptureRecord,
  Exercise,
  Goal,
  Plan,
  Post,
  Session,
  Side,
  SymptomProfile,
  Tab,
} from './types';
import { createId } from './utils/id';
import { exercises, getExercise } from './features/exercise-tracking/exercises';
import { matchedExercises } from './features/exercise-tracking/personalize';
import type { CaptureShare } from './features/camera/recording';
import {
  emptyData,
  readData,
  writeData,
  saveMedia,
  readMedia,
  deleteMedia,
} from './services/local';
import {
  supabase,
  loadCloud,
  saveCloud,
  loadPosts,
  createCloudPost,
  deleteCloudPost,
  toggleCloudLike,
  addCloudComment,
} from './services/cloud';
import { AppErrorContext } from './components/AppErrorContext';
import Modal from './components/Modal';
import AuthDialog from './components/AuthDialog';
import ExerciseArt from './components/ExerciseArt';
import SymptomForm from './pages/Onboarding/SymptomForm';
import MobileHome from './pages/Ascend/Home';
import RecordsPage from './pages/Ascend/Records';
import MorePage from './pages/Ascend/More';
import CommunityPage from './pages/Ascend/Community';
import type { FeedFilter } from './pages/Ascend/Community';
import ExercisePage from './pages/Exercise/ExercisePage';
import SessionDetail from './pages/Ascend/Feedback';
import GoalForm from './pages/Ascend/GoalSettings';
import RehabPlanning from './pages/Ascend/RehabPlan';
import PlanForm from './pages/RehabPlan/PlanForm';
import ComposeForm from './features/community/ComposeForm';
import SharePostDialog from './features/community/SharePostDialog';

const navigation: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: '홈', icon: Home },
  { id: 'records', label: '내 기록', icon: CalendarDays },
  { id: 'community', label: '커뮤니티', icon: MessageCircle },
  { id: 'more', label: '더보기', icon: MoreHorizontal },
];
function readRoute(): { tab: Tab; exerciseId?: string; postId?: string } {
  const [page, id, postId] = window.location.hash.replace(/^#\/?/, '').split('/');
  if (page === 'exercise' && exercises.some((ex) => ex.id === id))
    return { tab: 'home', exerciseId: id };
  if (page === 'community' && id === 'post' && postId) return { tab: 'community', postId };
  if (page === 'profile') return { tab: 'more' };
  return { tab: navigation.some((item) => item.id === page) ? (page as Tab) : 'home' };
}
function Brand() {
  return <span className="ascend-wordmark">ASCEND</span>;
}

export default function App() {
  const [installOpen, setInstallOpen] = useState(() =>
    new URLSearchParams(window.location.search).has('install'),
  );
  const [tab, setTab] = useState<Tab>(() => readRoute().tab),
    [exerciseId, setExerciseId] = useState<string | undefined>(() => readRoute().exerciseId),
    [focusedPost, setFocusedPost] = useState<string | undefined>(() => readRoute().postId);
  const [data, setData] = useState<AppData>(emptyData),
    [userId, setUserId] = useState('local-demo'),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(''),
    [actionError, setActionError] = useState('');
  const [rehabPlanning, setRehabPlanning] = useState(false);
  const [editingSymptoms, setEditingSymptoms] = useState(false),
    [selected, setSelected] = useState<Exercise>(),
    [browse, setBrowse] = useState(false),
    [startCamera, setStartCamera] = useState(false);
  const [detail, setDetail] = useState<Session>(),
    [compose, setCompose] = useState<Session | 'new'>(),
    [sharedPost, setSharedPost] = useState<Post>(),
    [goalEditor, setGoalEditor] = useState<Goal | 'new'>(),
    [planEditor, setPlanEditor] = useState<Plan>(),
    [auth, setAuth] = useState(false),
    [help, setHelp] = useState(false),
    [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [captureReview, setCaptureReview] = useState<CaptureRecord>(),
    [captureSide, setCaptureSide] = useState<Side>('left'),
    [composeMedia, setComposeMedia] = useState<Blob>(),
    [composeCaption, setComposeCaption] = useState(''),
    [composeNotice, setComposeNotice] = useState('');
  const mutations = useRef<Promise<void>>(Promise.resolve());
  const userRef = useRef(userId),
    dataRef = useRef(data);
  userRef.current = userId;
  dataRef.current = data;
  useEffect(
    () => setActionError(''),
    [selected, detail, compose, sharedPost, goalEditor, planEditor, auth, help, editingSymptoms],
  );
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) setToast(error.message);
      else setUserId(session?.user.id ?? 'local-demo');
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? 'local-demo');
      setExerciseId(undefined);
      setDetail(undefined);
      setCompose(undefined);
      setComposeMedia(undefined);
      setCaptureReview(undefined);
      setSelected(undefined);
      setEditingSymptoms(false);
      setStartCamera(false);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    setReady(false);
    setData(emptyData());
    (async () => {
      const local = await readData(userId);
      let next = local;
      if (userId !== 'local-demo') {
        next = await loadCloud();
        next.captures = local.captures;
        if (
          next.preferences.rehabilitation?.id === local.preferences.rehabilitation?.id &&
          next.preferences.rehabilitation
        ) {
          next.preferences.rehabilitation.attachment = local.preferences.rehabilitation?.attachment;
        }
        next.sessions = next.sessions.map((session) => ({
          ...session,
          mediaId: local.sessions.find((s) => s.id === session.id)?.mediaId,
        }));
      }
      if (active) {
        setData(next);
        setReady(true);
      }
    })().catch((error) => {
      if (active) {
        setActionError(error.message);
        setToast(`데이터를 불러오지 못했어요: ${error.message}`);
      }
    });
    return () => {
      active = false;
    };
  }, [userId]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const change = () => {
      const route = readRoute();
      setTab(route.tab);
      setExerciseId(route.exerciseId);
      setFocusedPost(route.postId);
      setGoalEditor(undefined);
      setRehabPlanning(false);
      setDetail(undefined);
      if (!route.exerciseId) setStartCamera(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  function navigate(next: Tab) {
    window.location.hash = `/${next}`;
    setTab(next);
    setExerciseId(undefined);
    setFocusedPost(undefined);
    setStartCamera(false);
    setCaptureReview(undefined);
    setEditingSymptoms(false);
    setGoalEditor(undefined);
    setDetail(undefined);
    setRehabPlanning(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function update(value: AppData | ((current: AppData) => AppData), remote = true) {
    const account = userId;
    const operation = mutations.current
      .catch(() => {})
      .then(async () => {
        if (userRef.current !== account) throw new Error('Account changed. Please retry.');
        const next = typeof value === 'function' ? value(dataRef.current) : value;
        if (remote && account !== 'local-demo') await saveCloud(next);
        if (userRef.current !== account) return;
        await writeData(account, next);
        dataRef.current = next;
        setData(next);
      });
    mutations.current = operation.catch(() => {});
    return operation;
  }
  async function run(action: () => Promise<void>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setActionError('');
    try {
      await action();
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '작업을 완료하지 못했어요. 다시 시도해 주세요.';
      setActionError(message);
      setToast(message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveSymptoms(symptoms: SymptomProfile) {
    await update((current) => ({ ...current, symptoms }));
    setEditingSymptoms(false);
    navigate('home');
    setToast('입력한 부위에 맞춰 운동을 다시 모았어요.');
  }
  function beginExercise(exercise: Exercise) {
    setSelected(undefined);
    setBrowse(false);
    setStartCamera(true);
    setCaptureReview(undefined);
    setExerciseId(exercise.id);
    window.location.hash = `/exercise/${exercise.id}`;
    window.scrollTo({ top: 0 });
  }
  async function saveSession(session: Session, blob?: Blob) {
    if (blob) await saveMedia(userId, session.id, blob);
    await update((current) => ({
      ...current,
      sessions: [
        ...current.sessions.filter((item) => item.id !== session.id),
        { ...session, mediaId: blob ? session.id : session.mediaId },
      ],
    }));
  }
  async function saveCapture(capture: CaptureRecord, blob?: Blob) {
    if (blob && capture.mediaId) await saveMedia(userId, capture.mediaId, blob);
    await update(
      (current) => ({
        ...current,
        captures: [...current.captures.filter((item) => item.id !== capture.id), capture],
      }),
      false,
    );
  }
  function openCapture(capture: CaptureRecord) {
    setCaptureReview(capture);
    setStartCamera(false);
    setExerciseId(capture.exerciseId);
    window.location.hash = `/exercise/${capture.exerciseId}`;
  }
  function openComposer({
    session,
    media,
    caption = '',
    notice = '',
  }: {
    session?: Session;
    media?: Blob;
    caption?: string;
    notice?: string;
  } = {}) {
    setComposeMedia(media);
    setComposeCaption(caption);
    setComposeNotice(notice);
    setCompose(session ?? 'new');
  }
  function closeComposer() {
    setCompose(undefined);
    setComposeMedia(undefined);
    setComposeCaption('');
    setComposeNotice('');
  }
  function composeCapture(draft: CaptureShare) {
    openComposer({
      session: draft.session,
      media: draft.blob,
      caption: getExercise(draft.capture.exerciseId).name,
    });
  }
  async function composeRecord(record: Session | CaptureRecord) {
    const account = userRef.current;
    const media = record.mediaId ? await readMedia(account, record.mediaId) : undefined;
    if (userRef.current !== account) return;
    openComposer({
      session:
        'analysis' in record
          ? record
          : dataRef.current.sessions.find((session) => session.id === record.id),
      media,
      caption: getExercise(record.exerciseId).name,
      notice: media
        ? ''
        : '이 기기에 원본 영상이 없어요. 글이나 선택한 분석만 공유하거나 영상을 직접 첨부할 수 있어요.',
    });
    setDetail(undefined);
  }
  async function removeSession(session: Session) {
    await update((current) => ({
      ...current,
      sessions: current.sessions.filter((s) => s.id !== session.id),
      captures: current.captures.filter((capture) => capture.id !== session.id),
    }));
    if (session.mediaId) await deleteMedia(userId, session.mediaId);
    setDetail(undefined);
    setToast(
      '기록과 기기에 보관한 영상을 삭제했어요. 별도로 공유한 게시글은 커뮤니티에서 관리할 수 있어요.',
    );
  }
  async function removeCapture(capture: CaptureRecord) {
    await update((current) => ({
      ...current,
      captures: current.captures.filter((item) => item.id !== capture.id),
      sessions: current.sessions.filter((item) => item.id !== capture.id),
    }));
    if (capture.mediaId) await deleteMedia(userId, capture.mediaId);
    navigate('home');
  }
  async function refreshPosts(localPosts?: Post[]) {
    const account = userId;
    if (userRef.current !== account) return;
    const posts =
      account === 'local-demo' ? (localPosts ?? dataRef.current.posts) : await loadPosts();
    if (userRef.current !== account) return;
    await update((current) => ({ ...current, posts }), false);
  }
  async function publish(post: Post, media?: Blob) {
    if (userId !== 'local-demo') await createCloudPost(post, media);
    else if (media) await saveMedia(userId, post.id, media);
    await refreshPosts([
      { ...post, mediaId: media ? post.id : undefined, mediaType: media?.type },
      ...dataRef.current.posts,
    ]);
    closeComposer();
    setFeedFilter('all');
    navigate('community');
    setToast(
      userId === 'local-demo'
        ? '이 브라우저의 데모 피드에 게시했어요.'
        : '선택한 정보로 이야기를 공유했어요.',
    );
  }
  async function like(post: Post) {
    if (userId !== 'local-demo') await toggleCloudLike(post, userId);
    await refreshPosts(
      dataRef.current.posts.map((p) =>
        p.id === post.id
          ? {
              ...p,
              likes: p.likes.includes(userId)
                ? p.likes.filter((id) => id !== userId)
                : [...p.likes, userId],
            }
          : p,
      ),
    );
  }
  async function comment(post: Post, content: string) {
    const item = {
      id: createId(),
      userId,
      nickname: data.nickname,
      content,
      createdAt: new Date().toISOString(),
    };
    if (userId !== 'local-demo') await addCloudComment(post.id, item);
    await refreshPosts(
      dataRef.current.posts.map((p) =>
        p.id === post.id ? { ...p, comments: [...p.comments, item] } : p,
      ),
    );
  }
  async function removePost(post: Post) {
    if (userId !== 'local-demo') await deleteCloudPost(post);
    else if (post.mediaId) await deleteMedia(userId, post.mediaId);
    await refreshPosts(dataRef.current.posts.filter((p) => p.id !== post.id));
  }
  function exportRecords() {
    const blob = new Blob([JSON.stringify(data.sessions, null, 2)], { type: 'application/json' }),
      url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = 'ascend-records.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const onboarding = ready && (!data.symptoms || editingSymptoms);
  return (
    <AppErrorContext.Provider value={actionError}>
      <div
        className={`app-shell mobile-product ascend-app ${exerciseId ? 'capture-active' : ''} ${onboarding ? 'onboarding-mode' : ''}`}
      >
        <header
          className="topbar"
          hidden={
            !!exerciseId ||
            !!goalEditor ||
            !!detail ||
            rehabPlanning ||
            tab !== 'home' ||
            onboarding
          }
        >
          <button className="brand-home" aria-label="ASCEND 홈" onClick={() => navigate('home')}>
            <Brand />
          </button>
          <div className="topbar-right">
            <InstallApp
              open={installOpen}
              onOpen={() => setInstallOpen(true)}
              onClose={() => {
                setInstallOpen(false);
                const url = new URL(window.location.href);
                url.searchParams.delete('install');
                window.history.replaceState(null, '', url);
              }}
            />
            <span className="local-badge">
              <span />
              {userId === 'local-demo' ? '로컬 데모' : '내 계정'}
            </span>
            {!onboarding && (
              <button
                className="icon-button header-camera"
                aria-label="운동 촬영"
                onClick={() =>
                  setSelected(
                    getExercise(
                      data.preferences.rehabilitation?.targetExerciseId ??
                        matchedExercises(data.symptoms!)[0]?.id ??
                        'knee',
                    ),
                  )
                }
              >
                <Camera size={23} />{' '}
              </button>
            )}
          </div>
        </header>
        <main aria-busy={!ready || busy} hidden={!!goalEditor || !!detail || rehabPlanning}>
          {!ready ? (
            <div className="loading-state">
              <Activity className="pulse" />
              <h2>나의 공간을 준비하고 있어요</h2>
              {actionError && (
                <>
                  <p className="error" role="alert">
                    {actionError}
                  </p>
                  <button className="secondary" onClick={() => window.location.reload()}>
                    다시 불러오기
                  </button>
                </>
              )}
            </div>
          ) : onboarding ? (
            <>
              <SymptomForm
                key={editingSymptoms ? 'edit' : 'first'}
                profile={data.symptoms}
                busy={busy}
                onSave={(profile) => void run(() => saveSymptoms(profile))}
                onCancel={data.symptoms ? () => setEditingSymptoms(false) : undefined}
              />
              {actionError && (
                <p className="error" role="alert">
                  {actionError}
                </p>
              )}
            </>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={exerciseId ?? tab}
                initial={exerciseId ? false : { opacity: 0, y: 8 }}
                animate={exerciseId ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                {exerciseId ? (
                  <ExercisePage
                    key={`${exerciseId}:${captureReview?.id ?? 'new'}`}
                    exercise={getExercise(exerciseId)}
                    sessions={data.sessions}
                    onBack={() => navigate('home')}
                    onSave={saveSession}
                    onShare={composeCapture}
                    onCaptureSaved={saveCapture}
                    onDelete={(capture) => void run(() => removeCapture(capture))}
                    initialCapture={
                      captureReview?.exerciseId === exerciseId ? captureReview : undefined
                    }
                    userId={userId}
                    onChooseExercise={() => setSelected(getExercise(exerciseId))}
                    autoConnect={startCamera}
                    consentGranted={startCamera}
                    initialSide={captureSide}
                    keepVideoDefault={data.preferences.saveOriginal}
                  />
                ) : (
                  <>
                    {tab === 'home' && (
                      <MobileHome
                        data={data}
                        onGoal={() =>
                          setGoalEditor(
                            data.goals.find((goal) => goal.primary) ?? data.goals[0] ?? 'new',
                          )
                        }
                        onSelect={setSelected}
                      />
                    )}
                    {tab === 'records' && (
                      <RecordsPage
                        userId={userId}
                        sessions={data.sessions}
                        captures={data.captures}
                        onCapture={openCapture}
                        onDetail={setDetail}
                        onShare={(record) => void run(() => composeRecord(record))}
                        busy={busy}
                        onStart={() => navigate('home')}
                      />
                    )}
                    {tab === 'community' && (
                      <CommunityPage
                        posts={data.posts}
                        following={data.preferences.following ?? []}
                        onFollow={(id) =>
                          void run(() =>
                            update((current) => ({
                              ...current,
                              preferences: {
                                ...current.preferences,
                                following: (current.preferences.following ?? []).includes(id)
                                  ? (current.preferences.following ?? []).filter(
                                      (value) => value !== id,
                                    )
                                  : [...(current.preferences.following ?? []), id],
                              },
                            })),
                          )
                        }
                        userId={userId}
                        busy={busy}
                        filter={feedFilter}
                        focusedId={focusedPost}
                        onFilter={(filter) => {
                          setFeedFilter(filter);
                          setFocusedPost(undefined);
                          window.history.replaceState(null, '', '#/community');
                        }}
                        onCompose={() => openComposer()}
                        onRefresh={() => void run(() => refreshPosts())}
                        onLike={(post) => void run(() => like(post))}
                        onComment={(post, text) => run(() => comment(post, text))}
                        onDelete={(post) => void run(() => removePost(post))}
                        onShare={setSharedPost}
                      />
                    )}
                    {tab === 'more' && (
                      <MorePage
                        data={data}
                        local={userId === 'local-demo'}
                        busy={busy}
                        onSymptoms={() => setEditingSymptoms(true)}
                        onNickname={(nickname) =>
                          void run(async () => {
                            await update((current) => ({ ...current, nickname }));
                            setToast('닉네임을 저장했어요.');
                          })
                        }
                        onPreferences={(preferences) =>
                          void run(() => update((current) => ({ ...current, preferences })))
                        }
                        userId={userId}
                        onPlan={() => setRehabPlanning(true)}
                        onExport={exportRecords}
                        onDeleteRecords={() =>
                          void run(async () => {
                            const mediaIds = new Set(
                              [...dataRef.current.sessions, ...dataRef.current.captures].flatMap(
                                (s) => (s.mediaId ? [s.mediaId] : []),
                              ),
                            );
                            await update((current) => ({ ...current, sessions: [], captures: [] }));
                            await Promise.all([...mediaIds].map((id) => deleteMedia(userId, id)));
                            setToast('운동 기록과 원본 영상을 삭제했어요.');
                          })
                        }
                        onGoal={() =>
                          setGoalEditor(
                            data.goals.find((goal) => goal.primary) ?? data.goals[0] ?? 'new',
                          )
                        }
                        onOwnPosts={() => {
                          navigate('community');
                          setFeedFilter('mine');
                        }}
                        onAuth={() => {
                          if (userId === 'local-demo') setAuth(true);
                          else
                            void run(async () => {
                              const { error } = await supabase!.auth.signOut();
                              if (error) throw error;
                            });
                        }}
                        onHelp={() => setHelp(true)}
                      />
                    )}
                  </>
                )}
                <footer className="page-footer" hidden={!!exerciseId}>
                  <span>
                    <Activity size={14} /> ASCEND · 나의 속도로, 한 걸음씩
                  </span>
                  <span>의료진의 진단과 치료를 대신하지 않습니다.</span>
                </footer>
              </motion.div>
            </AnimatePresence>
          )}
        </main>
        {ready && !onboarding && !exerciseId && (
          <nav className="bottom-nav" aria-label="주 메뉴">
            {navigation.map((item) => (
              <button
                key={item.id}
                aria-current={
                  (goalEditor || rehabPlanning ? 'more' : detail ? 'records' : tab) === item.id &&
                  !exerciseId
                    ? 'page'
                    : undefined
                }
                className={
                  (goalEditor || rehabPlanning ? 'more' : detail ? 'records' : tab) === item.id &&
                  !exerciseId
                    ? 'active'
                    : ''
                }
                onClick={() => navigate(item.id)}
              >
                <item.icon size={22} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        )}
        {toast && (
          <div className="toast" role="status">
            <span>{toast}</span>
            <button onClick={() => setToast('')} aria-label="알림 닫기">
              <X size={17} />
            </button>
          </div>
        )}
        {selected && (
          <CameraExercisePicker
            initial={selected}
            initialSide={data.symptoms?.side === 'right' ? 'right' : 'left'}
            onClose={() => setSelected(undefined)}
            onStart={(exercise, side) => {
              setCaptureSide(side);
              beginExercise(exercise);
            }}
          />
        )}
        {browse && (
          <Modal title="전체 참고 운동" onClose={() => setBrowse(false)}>
            <p className="form-description">
              선택한 부위와 관계없이 전체 자료를 둘러볼 수 있어요. 개인에게 적합하다는 의미는
              아닙니다.
            </p>
            {exercises.map((exercise) => (
              <button
                className="more-row"
                key={exercise.id}
                onClick={() => {
                  setBrowse(false);
                  setSelected(exercise);
                }}
              >
                <div className={`browse-art ${exercise.color}`}>
                  <ExerciseArt type={exercise.id} />
                </div>
                <div>
                  <strong>{exercise.name}</strong>
                  <small>
                    {exercise.bodyPart} · {exercise.duration}
                  </small>
                </div>
                <ArrowRight size={18} />
              </button>
            ))}
          </Modal>
        )}
        {auth && <AuthDialog onClose={() => setAuth(false)} busy={busy} run={run} />}
        {rehabPlanning && !goalEditor && (
          <RehabPlanning
            goal={data.preferences.rehabilitation}
            sessions={data.sessions}
            busy={busy}
            onBack={() => setRehabPlanning(false)}
            onEdit={() => setGoalEditor(data.goals.find((goal) => goal.primary) ?? 'new')}
            onApply={(notes) =>
              void run(async () => {
                await update((current) => ({
                  ...current,
                  preferences: {
                    ...current.preferences,
                    rehabilitation: current.preferences.rehabilitation
                      ? { ...current.preferences.rehabilitation, requestNotes: notes }
                      : undefined,
                  },
                }));
                setToast('요청 사항을 계획에 저장했어요.');
              })
            }
            onStart={() =>
              void run(async () => {
                const rehab = dataRef.current.preferences.rehabilitation;
                if (!rehab) return;
                await update((current) => ({
                  ...current,
                  preferences: {
                    ...current.preferences,
                    rehabilitation: {
                      ...rehab,
                      startedAt: rehab.startedAt ?? new Date().toISOString(),
                    },
                  },
                }));
                navigate('home');
                setSelected(getExercise(rehab.exerciseIds[0]));
              })
            }
          />
        )}
        {goalEditor && (
          <GoalForm
            goal={goalEditor === 'new' ? undefined : goalEditor}
            rehabilitation={data.preferences.rehabilitation}
            symptoms={data.symptoms}
            sessions={data.sessions}
            busy={busy}
            onClose={() => setGoalEditor(undefined)}
            onSave={(goal, rehabilitation, attachment) =>
              void run(async () => {
                const previousAttachment = dataRef.current.preferences.rehabilitation?.attachment;
                if (attachment) {
                  const id = `diagnosis-${createId()}`;
                  await saveMedia(userId, id, attachment);
                  rehabilitation.attachment = {
                    id,
                    name: attachment.name,
                    type: attachment.type,
                    size: attachment.size,
                  };
                }
                await update((current) => ({
                  ...current,
                  preferences: { ...current.preferences, rehabilitation },
                  goals: [
                    ...current.goals
                      .filter((g) => g.id !== goal.id)
                      .map((g) => ({ ...g, primary: false })),
                    goal,
                  ],
                  plans: current.plans.map((plan) =>
                    rehabilitation.exerciseIds.includes(plan.exerciseId)
                      ? {
                          ...plan,
                          repetitions: rehabilitation.repetitions,
                          frequency: `주 ${rehabilitation.weekdays.length}일`,
                          source: 'personal' as const,
                        }
                      : plan,
                  ),
                }));
                if (previousAttachment && previousAttachment.id !== rehabilitation.attachment?.id)
                  await deleteMedia(userId, previousAttachment.id);
                setGoalEditor(undefined);
                setRehabPlanning(true);
                setToast('목표를 저장했어요.');
              })
            }
          />
        )}
        {planEditor && (
          <PlanForm
            plan={planEditor}
            busy={busy}
            onClose={() => setPlanEditor(undefined)}
            onSave={(plan) =>
              void run(async () => {
                await update((current) => ({
                  ...current,
                  plans: current.plans.map((p) => (p.id === plan.id ? plan : p)),
                }));
                setPlanEditor(undefined);
              })
            }
          />
        )}
        {compose && (
          <ComposeForm
            session={compose === 'new' ? undefined : compose}
            initialMedia={composeMedia}
            initialCaption={composeCaption}
            attachmentNotice={composeNotice}
            sessions={data.sessions}
            nickname={data.nickname}
            userId={userId}
            busy={busy}
            onClose={closeComposer}
            onSubmit={(post, media) => void run(() => publish(post, media))}
          />
        )}
        {sharedPost && (
          <SharePostDialog
            post={sharedPost}
            local={userId === 'local-demo'}
            onClose={() => setSharedPost(undefined)}
          />
        )}
        {detail && (
          <SessionDetail
            session={detail}
            sessions={data.sessions}
            userId={userId}
            busy={busy}
            goal={data.preferences.rehabilitation}
            onBack={() => setDetail(undefined)}
            onRecords={() => navigate('records')}
            onDelete={() => void run(() => removeSession(detail))}
            onShare={() => void run(() => composeRecord(detail))}
            onRemoveVideo={() =>
              void run(async () => {
                if (detail.mediaId) await deleteMedia(userId, detail.mediaId);
                const updated = { ...detail, mediaId: undefined };
                await update((current) => ({
                  ...current,
                  sessions: current.sessions.map((s) => (s.id === detail.id ? updated : s)),
                  captures: current.captures.map((c) =>
                    c.id === detail.id ? { ...c, mediaId: undefined } : c,
                  ),
                }));
                setDetail(updated);
              })
            }
          />
        )}
        {help && (
          <Modal title="나의 속도로 함께 시작해요" onClose={() => setHelp(false)}>
            <ol className="help-steps">
              <li>
                <Check />
                <div>
                  <h3>내 불편함을 알려주세요</h3>
                  <p>입력한 부위를 기준으로 참고 운동을 모아드려요.</p>
                </div>
              </li>
              <li>
                <Camera />
                <div>
                  <h3>운동을 선택하고 시작해요</h3>
                  <p>오른쪽 위 카메라에서 운동을 고르면 실시간 관절 추적을 시작해요.</p>
                </div>
              </li>
              <li>
                <CalendarDays />
                <div>
                  <h3>내 기록에서 변화를 확인해요</h3>
                  <p>영상과 측정 결과를 저장하고 같은 조건의 기록끼리 비교해요.</p>
                </div>
              </li>
              <li>
                <Users />
                <div>
                  <h3>커뮤니티에서 함께 응원해요</h3>
                  <p>직접 고른 정보만 공유하고 서로의 한 걸음을 응원해요.</p>
                </div>
              </li>
            </ol>
            <p className="notice">
              입력 내용만으로 진단하거나 운동을 처방하지 않습니다. 통증이나 불편함이 생기면 운동을
              중단하고 의료진과 상담하세요.
            </p>
            <button className="primary full-width" onClick={() => setHelp(false)}>
              확인했어요
            </button>
          </Modal>
        )}
      </div>
    </AppErrorContext.Provider>
  );
}
