import { useContext, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppErrorContext } from './AppErrorContext';
export default function Modal({
  title,
  children,
  onClose,
  wide = false,
  headerActions,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  headerActions?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const error = useContext(AppErrorContext);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''} ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        {headerActions}
        <button type="button" className="icon-button" onClick={onClose} aria-label="닫기">
          <X size={22} />
        </button>
      </div>
      <div className="modal-content">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}
