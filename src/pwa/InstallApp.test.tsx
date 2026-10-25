// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import InstallApp from './InstallApp';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('shows actionable Safari steps without claiming to install automatically', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari');
  const close = vi.fn();
  render(<InstallApp open onClose={close} />);
  expect(screen.getByText('홈 화면에 추가 → 추가')).toBeDefined();
  expect(screen.queryByRole('button', { name: '앱 설치하기' })).toBeNull();
  await userEvent.setup().click(screen.getByRole('button', { name: '확인' }));
  expect(close).toHaveBeenCalledOnce();
});
it('runs a supported native install prompt only after the user taps install', async () => {
  const user = userEvent.setup(),
    prompt = vi.fn().mockResolvedValue(undefined);
  render(<InstallApp />);
  const offered = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  });
  act(() => window.dispatchEvent(offered));
  expect(offered.defaultPrevented).toBe(true);
  expect(prompt).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '앱 설치' }));
  await user.click(screen.getByRole('button', { name: '앱 설치하기' }));
  expect(prompt).toHaveBeenCalledOnce();
  expect(await screen.findByRole('status')).toBeDefined();
  expect(screen.queryByText('홈 화면에서 ASCEND를 열어 주세요')).toBeNull();
  act(() => window.dispatchEvent(new Event('appinstalled')));
  expect(await screen.findByText('홈 화면에서 ASCEND를 열어 주세요')).toBeDefined();
});
it('shows Android installation and shortcut steps without Safari instructions', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome');
  render(<InstallApp open />);
  expect(screen.getByText('이 주소를 Chrome에서 열기')).toBeDefined();
  expect(screen.getByText('오른쪽 위 ⋮ 메뉴 열기')).toBeDefined();
  expect(screen.getByText(/설치가 막히면 ‘바로가기 만들기’/)).toBeDefined();
  expect(screen.queryByText(/Safari/)).toBeNull();
});
it('detects standalone mode and hides the redundant header install button', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  render(<InstallApp />);
  expect(screen.queryByRole('button', { name: '앱 설치' })).toBeNull();
});
