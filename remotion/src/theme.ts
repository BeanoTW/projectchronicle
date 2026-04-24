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
// Scenes: 50+70+105+90+105+110+90 = 620
// Transitions overlap: 4 fades × 8 + 2 slides × 14 = 60 frames
// Effective: 620 - 60 = 560 frames ≈ 18.7s (target ~21s, closing carries trust message)
export const TOTAL_FRAMES = 620;
export const FPS = 30;

export const SCENE_FRAMES = {
  wordmark: 50,
  recordVoice: 70,
  recording: 105,
  structured: 90,
  timeline: 105,    // slightly longer to read new entry + caption
  exportShare: 110,
  closing: 90,      // longer to read two-line trust message
};
