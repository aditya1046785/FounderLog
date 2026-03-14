export const COLORS = {
  background: '#0A0A0F',
  surface: '#14141F',
  surfaceLight: '#1E1E2E',
  glassBg: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.10)',

  accent: '#FFB800',
  accentGlow: 'rgba(255,184,0,0.3)',
  accentDim: 'rgba(255,184,0,0.15)',

  fire: '#FF6B35',
  fireGlow: 'rgba(255,107,53,0.3)',

  statusOpen: '#FF4757',
  statusOpenGlow: 'rgba(255,71,87,0.4)',
  statusExploring: '#FFB800',
  statusExploringGlow: 'rgba(255,184,0,0.4)',
  statusSolved: '#2ED573',
  statusSolvedGlow: 'rgba(46,213,115,0.4)',

  textPrimary: '#FFFFFF',
  textSecondary: '#8B8B9E',
  textTertiary: '#5A5A6E',
  textAccent: '#FFB800',

  danger: '#FF4757',
  success: '#2ED573',
  info: '#3742FA',

  navBg: '#0D0D14',
  navActive: '#FFB800',
  navInactive: '#5A5A6E',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 999,
} as const;

export const FONT_SIZES = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  hero: 34,
  giant: 42,
} as const;

export const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

export const GLASS_STYLE = {
  backgroundColor: COLORS.glassBg,
  borderWidth: 1,
  borderColor: COLORS.glassBorder,
  borderRadius: BORDER_RADIUS.lg,
} as const;

export const SHADOWS = {
  glowAmber: {
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  glowRed: {
    shadowColor: '#FF4757',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  glowGreen: {
    shadowColor: '#2ED573',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
