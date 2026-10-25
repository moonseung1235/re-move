import { useEffect, useState } from 'react';
import { Check, Download, MoreVertical, PlusSquare, Share } from 'lucide-react';
import Modal from '../components/Modal';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
function appMode() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
export default function InstallApp({
  open,
  onOpen,
  onClose,
  row = false,
}: {
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  row?: boolean;
}) {
  const [installed, setInstalled] = useState(appMode),
    [standalone] = useState(appMode),
    [localOpen, setLocalOpen] = useState(false),
    [prompt, setPrompt] = useState<InstallPrompt>(),
    [installRequested, setInstallRequested] = useState(false),
    [error, setError] = useState('');
  const appleDevice =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  useEffect(() => {
    const offered = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const added = () => {
      setInstalled(true);
      setPrompt(undefined);
    };
    window.addEventListener('beforeinstallprompt', offered);
    window.addEventListener('appinstalled', added);
    return () => {
      window.removeEventListener('beforeinstallprompt', offered);
      window.removeEventListener('appinstalled', added);
    };
  }, []);
  const visible = open ?? localOpen;
  const close = () => {
    setLocalOpen(false);
    onClose?.();
  };
  return (
    <>
      {(!installed || row) && (
        <button
          className={row ? 'more-row' : 'icon-button header-install'}
          aria-label={installed ? '앱 설치 상태' : '앱 설치'}
          onClick={() => {
            if (onOpen) onOpen();
            else setLocalOpen(true);
          }}
        >
          {installed ? <Check size={20} /> : <Download size={20} />}
          {row && (
            <span>
              {standalone ? '앱으로 실행 중' : installed ? '앱 설치 완료' : '홈 화면에 앱 설치'}
            </span>
          )}
        </button>
      )}
      {visible && (
        <Modal title={installed ? 'ASCEND 앱' : 'ASCEND 앱 설치'} onClose={close}>
          <div className="install-app-intro">
            <img src="/apple-touch-icon.png" width="72" height="72" alt="ASCEND" />
            <h3>
              {standalone
                ? '앱으로 실행하고 있어요'
                : installed
                  ? '홈 화면에서 ASCEND를 열어 주세요'
                  : '홈 화면에서 바로 시작해요'}
            </h3>
            <p>홈 화면 아이콘 · 전체화면 · 기기 내 운동 기록</p>
          </div>
          {!installed && (
            <>
              {prompt && (
                <button
                  className="primary full-width"
                  onClick={async () => {
                    try {
                      await prompt.prompt();
                      const choice = await prompt.userChoice;
                      if (choice.outcome === 'accepted') setInstallRequested(true);
                      setPrompt(undefined);
                    } catch {
                      setError(
                        '설치 요청을 열지 못했어요. 브라우저 메뉴에서 아래 방법으로 추가해 주세요.',
                      );
                    }
                  }}
                >
                  <Download size={18} /> 앱 설치하기
                </button>
              )}
              {installRequested && (
                <p className="install-app-note" role="status">
                  설치를 요청했어요. 완료되면 홈 화면의 ASCEND 아이콘을 눌러 주세요. 오류가 나오면
                  브라우저 메뉴의 ‘바로가기 만들기’로 추가할 수도 있어요.
                </p>
              )}
              <ol className="install-app-steps">
                <li>
                  <span>1</span>
                  <div>
                    <strong>이 주소를 {appleDevice ? 'Safari' : 'Chrome'}에서 열기</strong>
                    <small>
                      카카오톡·ChatGPT 안의 브라우저에서는 {appleDevice ? 'Safari' : 'Chrome'}로
                      열어 주세요.
                    </small>
                  </div>
                </li>
                <li>
                  {appleDevice ? <Share size={22} /> : <MoreVertical size={22} />}
                  <div>
                    <strong>{appleDevice ? '공유 버튼 누르기' : '오른쪽 위 ⋮ 메뉴 열기'}</strong>
                    <small>
                      {appleDevice
                        ? '공유 메뉴가 안 보이면 메뉴에서 ‘공유’를 찾아 주세요.'
                        : '‘설치 및 바로가기 만들기’ 또는 ‘홈 화면에 추가’를 선택해 주세요.'}
                    </small>
                  </div>
                </li>
                <li>
                  <PlusSquare size={22} />
                  <div>
                    <strong>
                      {appleDevice ? '홈 화면에 추가 → 추가' : '설치 → 홈 화면에서 실행'}
                    </strong>
                    <small>
                      {appleDevice
                        ? '‘웹 앱으로 열기’가 보이면 켜 두세요.'
                        : '설치가 막히면 ‘바로가기 만들기’를 선택해 웹으로 사용할 수 있어요.'}
                    </small>
                  </div>
                </li>
              </ol>
              <p className="install-app-note">
                추가한 ASCEND 아이콘을 누르면 앱으로 실행돼요. 첫 실행은 인터넷 연결이 필요합니다.
              </p>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="secondary full-width" onClick={close}>
            확인
          </button>
        </Modal>
      )}
    </>
  );
}
