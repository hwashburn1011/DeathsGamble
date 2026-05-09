// Design tokens for the Liquid Glass dark theme.
// Pull these from React via plain imports (TS) and CSS via the var()
// fallbacks defined in globals.css.

export const palette = {
  // Background depths
  voidBlack: '#040406',
  shadow: '#07070a',
  hood: '#0d0d12',
  charcoal: '#15151a',
  edge: '#2a2a32',

  // Ink (foreground)
  ink: '#e9e6df',
  inkMuted: '#a09a8a',
  inkDim: '#6f6a5e',

  // Accents
  gold: '#c9a227',
  goldBright: '#f0c84a',
  candle: '#ffd070',

  // Status
  blood: '#b03030',
  bloodBright: '#e04848',
  moss: '#4d8a52',
  mossBright: '#69b070',
  arcane: '#5a8af0',
  arcaneBright: '#80b0ff',
} as const;

export const glass = {
  // Frosted glass surface
  fillDark: 'rgba(13, 13, 22, 0.55)',
  fillMid: 'rgba(20, 20, 32, 0.45)',
  fillLight: 'rgba(40, 40, 60, 0.35)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHi: 'rgba(255, 255, 255, 0.16)',
  innerHighlight: 'rgba(255, 255, 255, 0.10)',
  blurStrong: 'blur(24px) saturate(140%)',
  blurMid: 'blur(16px) saturate(130%)',
  blurSoft: 'blur(8px) saturate(120%)',
} as const;

export const motion = {
  swift: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  smooth: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  ease: '500ms cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

export const radii = {
  xs: '4px',
  sm: '6px',
  md: '10px',
  lg: '16px',
  pill: '999px',
} as const;

export const space = {
  xs: '4px',
  sm: '8px',
  md: '14px',
  lg: '22px',
  xl: '32px',
  '2xl': '48px',
} as const;

export const typography = {
  display: '"Cinzel", "Times New Roman", serif',
  body: '"Crimson Pro", "Georgia", serif',
  mono: '"Cinzel", monospace', // fallback - replace later if we add a true mono
} as const;
