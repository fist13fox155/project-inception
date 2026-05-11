export const theme = {
  colors: {
    bg: '#000000',
    surface: '#0A0A0A',
    surfaceElevated: '#141414',
    border: '#27272A',
    borderSubtle: '#1F1F22',
    text: '#FFFFFF',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    neon: '#D4FF00',
    green: '#00FF66',
    blue: '#00E5FF',
    purple: '#B026FF',
    danger: '#FF3366',
    glowNeon: 'rgba(212, 255, 0, 0.35)',
    glowGreen: 'rgba(0, 255, 102, 0.35)',
    glowBlue: 'rgba(0, 229, 255, 0.35)',
    glowPurple: 'rgba(176, 38, 255, 0.35)',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 6, md: 12, lg: 16, xl: 24, full: 999 },
  fonts: {
    heading: 'Rajdhani_700Bold',
    headingLight: 'Rajdhani_500Medium',
    body: 'SpaceGrotesk_400Regular',
    bodyMedium: 'SpaceGrotesk_500Medium',
    bodyBold: 'SpaceGrotesk_700Bold',
  },
};

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
export const API = `${BACKEND_URL}/api`;
