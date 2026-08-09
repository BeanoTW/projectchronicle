// Chronicle V2 (candidate) accessible dialog layer.
// Replaces native alert()/confirm(), which are unlabelled, unstyled and
// unavailable in some embedded/mobile webviews.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

export interface NoticeOptions {
  title: string;
  body: string;
  dismissLabel?: string;
}

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'notice'; opts: NoticeOptions; resolve: (v: boolean) => void };

interface DialogApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  notice: (opts: NoticeOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogApi | null>(null);

export const useDialogs = (): DialogApi => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs must be used inside <DialogProvider>');
  return ctx;
};

export const DialogProvider = ({ children }: { children: React.ReactNode }) => {
  const [pending, setPending] = useState<Pending | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>(resolve => {
        returnFocusRef.current = document.activeElement as HTMLElement | null;
        setPending({ kind: 'confirm', opts, resolve });
      }),
    [],
  );

  const notice = useCallback(
    (opts: NoticeOptions) =>
      new Promise<boolean>(resolve => {
        returnFocusRef.current = document.activeElement as HTMLElement | null;
        setPending({ kind: 'notice', opts, resolve });
      }),
    [],
  );

  const close = useCallback(
    (value: boolean) => {
      setPending(current => {
        current?.resolve(value);
        return null;
      });
      // Return focus to whatever opened the dialog.
      requestAnimationFrame(() => returnFocusRef.current?.focus?.());
    },
    [],
  );

  /* Escape to dismiss, and a simple focus loop inside the panel. */
  useEffect(() => {
    if (!pending) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pending, close]);

  return (
    <DialogContext.Provider value={{ confirm, notice }}>
      {children}
      {pending && (
        <div className="proto-dialog-backdrop" onMouseDown={() => close(false)}>
          <div
            ref={panelRef}
            className="proto-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="proto-dialog-title"
            aria-describedby={pending.opts.body ? 'proto-dialog-body' : undefined}
            onMouseDown={e => e.stopPropagation()}
          >
            <h2 id="proto-dialog-title" className="proto-dialog-title">{pending.opts.title}</h2>
            {pending.opts.body && (
              <p id="proto-dialog-body" className="proto-dialog-body">{pending.opts.body}</p>
            )}
            <div className="proto-dialog-actions">
              {pending.kind === 'confirm' ? (
                <>
                  <button className="proto-btn" data-variant="ghost" onClick={() => close(false)}>
                    {pending.opts.cancelLabel ?? 'Cancel'}
                  </button>
                  <button
                    className="proto-btn"
                    data-variant={pending.opts.tone === 'danger' ? 'danger' : 'primary'}
                    data-autofocus
                    onClick={() => close(true)}
                  >
                    {pending.opts.confirmLabel ?? 'Continue'}
                  </button>
                </>
              ) : (
                <button className="proto-btn" data-variant="primary" data-autofocus onClick={() => close(true)}>
                  {(pending.opts as NoticeOptions).dismissLabel ?? 'Close'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};
