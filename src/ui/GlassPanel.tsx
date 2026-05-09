import { CSSProperties, ReactNode, forwardRef } from 'react';
import './glass.css';

export type GlassVariant = 'default' | 'mid' | 'light';
export type GlassPadding = 'none' | 'sm' | 'md' | 'lg';

interface GlassPanelProps {
  children?: ReactNode;
  variant?: GlassVariant;
  padding?: GlassPadding;
  bordered?: boolean;
  hoverable?: boolean;
  glow?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  as?: keyof JSX.IntrinsicElements;
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  {
    children,
    variant = 'default',
    padding = 'md',
    bordered = true,
    hoverable = false,
    glow = false,
    className = '',
    style,
    onClick,
    as: Tag = 'div',
  },
  ref
) {
  const classes = [
    'glass',
    `glass--${variant}`,
    `glass--p-${padding}`,
    bordered ? 'glass--bordered' : '',
    hoverable ? 'glass--hoverable' : '',
    glow ? 'glass--glow' : '',
    onClick ? 'glass--interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // forwardRef + dynamic Tag — keep it loose to satisfy TS
  const Component = Tag as 'div';
  return (
    <Component ref={ref as any} className={classes} style={style} onClick={onClick}>
      {children}
    </Component>
  );
});
