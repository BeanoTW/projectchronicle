import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { COLOR, FONT, SCENE_FRAMES } from './theme';
import { SceneWordmark } from './scenes/SceneWordmark';
import { SceneRecordVoice } from './scenes/SceneRecordVoice';
import { SceneRecording } from './scenes/SceneRecording';
import { SceneStructured } from './scenes/SceneStructured';
import { SceneTimeline } from './scenes/SceneTimeline';
import { SceneExport } from './scenes/SceneExport';
import { SceneClosing } from './scenes/SceneClosing';

export type Orientation = 'vertical' | 'landscape';

export const PhoneFrame: React.FC<{ children: React.ReactNode; orientation: Orientation }> = ({
  children,
  orientation,
}) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  // Very subtle drift 1 → 1.02 over ~3s loop to avoid a static feel
  const drift = 1 + (Math.sin(frame / 90) + 1) / 2 * 0.02;

  // Focused canvas — denser, dominates the frame (~80% of vertical height).
  // ~5:6 aspect makes UI scale large and eliminates dead vertical space.
  let canvasW: number;
  let canvasH: number;
  if (orientation === 'vertical') {
    // 1080x1920: ~80% height, ~94% width
    canvasH = Math.round(height * 0.80);
    canvasW = Math.min(Math.round(canvasH * (5 / 6)), Math.round(width * 0.94));
  } else {
    // 1920x1080: tall canvas centred horizontally
    canvasH = Math.round(height * 0.92);
    canvasW = Math.round(canvasH * (5 / 6));
  }

  // Internal UI design height = canvas aspect; UI is built to fill it densely.
  const designW = 1080;
  const designH = 1200;
  const scale = canvasW / designW;
  const innerOffsetY = 0;

  return (
    <AbsoluteFill
      style={{
        // Atmospheric backdrop: warm surface with subtle pear-green bloom for depth
        background: `radial-gradient(ellipse 90% 70% at 50% 35%, ${COLOR.primarySoft} 0%, ${COLOR.surface} 45%, ${COLOR.bg} 100%)`,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONT.ui,
        color: COLOR.text,
      }}
    >
      <div
        style={{
          width: canvasW,
          height: canvasH,
          background: COLOR.bg,
          borderRadius: 32,
          border: `1px solid ${COLOR.border}`,
          boxShadow: `0 50px 100px -40px ${COLOR.shadow}, 0 18px 40px -22px ${COLOR.shadow}, 0 0 0 1px rgba(255,255,255,0.6) inset`,
          overflow: 'hidden',
          position: 'relative',
          transform: `scale(${drift})`,
          transformOrigin: 'center center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: innerOffsetY,
            left: 0,
            width: designW,
            height: designH,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, color: COLOR.text }}>{children}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  // Default crossfade between scenes (subtle, calm)
  const fadeT = () => ({
    presentation: fade(),
    timing: linearTiming({ durationInFrames: 8 }),
  });
  // Slight directional slide — used to imply the record moving through the system
  const slideT = () => ({
    presentation: slide({ direction: 'from-right' }),
    timing: linearTiming({ durationInFrames: 14 }),
  });

  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.wordmark}>
          <PhoneFrame orientation={orientation}><SceneWordmark /></PhoneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeT()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.recordVoice}>
          <PhoneFrame orientation={orientation}><SceneRecordVoice /></PhoneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeT()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.recording}>
          <PhoneFrame orientation={orientation}><SceneRecording /></PhoneFrame>
        </TransitionSeries.Sequence>
        {/* Record → Review: directional slide, the record "moves forward" */}
        <TransitionSeries.Transition {...slideT()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.structured}>
          <PhoneFrame orientation={orientation}><SceneStructured /></PhoneFrame>
        </TransitionSeries.Sequence>
        {/* Review → Timeline: immediate slide, the new record drops into place */}
        <TransitionSeries.Transition {...slideT()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.timeline}>
          <PhoneFrame orientation={orientation}><SceneTimeline /></PhoneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeT()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.exportShare}>
          <PhoneFrame orientation={orientation}><SceneExport /></PhoneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeT()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.closing}>
          <PhoneFrame orientation={orientation}><SceneClosing /></PhoneFrame>
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
