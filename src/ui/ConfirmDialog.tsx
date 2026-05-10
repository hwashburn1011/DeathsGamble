import { useEffect } from 'react';
import { GlassPanel } from './GlassPanel';
import { GlassButton } from './GlassButton';
import './confirm-dialog.css';

interface Props {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'gold' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);

  return (
    <div className="confirm-backdrop" onClick={onCancel}>
      <div className="confirm-card-wrap" onClick={(e) => e.stopPropagation()}>
        <GlassPanel padding="lg" className="confirm-card">
          <h3 className="display confirm-title">{title}</h3>
          <p className="confirm-body">{body}</p>
          <div className="confirm-actions">
            <GlassButton variant="ghost" size="sm" onClick={onCancel}>
              {cancelLabel}
            </GlassButton>
            <GlassButton variant={variant} size="sm" onClick={onConfirm}>
              {confirmLabel}
            </GlassButton>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
