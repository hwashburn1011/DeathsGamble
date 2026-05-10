import { ButtonHTMLAttributes, ReactNode, MouseEvent } from 'react';
import { AudioManager } from '../engine/audio/AudioManager';
import './button.css';

export type ButtonVariant = 'gold' | 'good' | 'danger' | 'magic' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  glow?: boolean;
  children?: ReactNode;
}

export function GlassButton({
  variant = 'gold',
  size = 'md',
  glow = false,
  className = '',
  children,
  onClick,
  onMouseEnter,
  ...rest
}: GlassButtonProps) {
  const classes = [
    'gbtn',
    `gbtn--${variant}`,
    `gbtn--${size}`,
    glow ? 'gbtn--glow' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  function handleEnter(e: MouseEvent<HTMLButtonElement>) {
    if (!e.currentTarget.disabled) AudioManager.play('ui_hover', { volume: 0.15 });
    onMouseEnter?.(e);
  }
  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (!e.currentTarget.disabled) AudioManager.play('ui_click', { volume: 0.4 });
    onClick?.(e);
  }

  return (
    <button {...rest} className={classes} onClick={handleClick} onMouseEnter={handleEnter}>
      <span className="gbtn__label">{children}</span>
    </button>
  );
}
