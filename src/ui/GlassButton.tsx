import { ButtonHTMLAttributes, ReactNode } from 'react';
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

  return (
    <button {...rest} className={classes}>
      <span className="gbtn__label">{children}</span>
    </button>
  );
}
