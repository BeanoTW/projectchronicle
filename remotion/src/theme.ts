import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadCormorant } from '@remotion/google-fonts/CormorantGaramond';

const inter = loadInter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });
const cormorant = loadCormorant('normal', { weights: ['500'], subsets: ['latin'] });

export const FONT = {
  ui: inter.fontFamily,
  display: cormorant.fontFamily,
};

// Brand tokens — hex equivalents of app's HSL design tokens
export const COLOR = {
  bg: '#FFFFFF',
  surface: '#FAFAF7',
  border: '#E8E5DD',
  borderStrong: '#D9D5C9',
  text: '#1F2A1A',
  textMuted: '#6B6F5E',
  textSubtle: '#9A9D8A',
  primary: '#7FBF5F',          // Pear green
  primaryDark: '#5FA042',
  primarySoft: '#EAF4DF',
  gold: '#C9A84C',             // Warm accent (Daily record)
  goldSoft: '#F6EFD8',
  destructive: '#D9534F',
  shadow: 'rgba(31,42,26,0.08)',
};

// Total composition duration (frames @ 30fps)
export const TOTAL_FRAMES = 630; // 21s
export const FPS = 30;

export const SCENE_FRAMES = {
  wordmark: 60,
  recordVoice: 75,
  recording: 90,
  structured: 105,
  daily: 60,
  timeline: 90,
  exportShare: 90,
  closing: 60,
};
