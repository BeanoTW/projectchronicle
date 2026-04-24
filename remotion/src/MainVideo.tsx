import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { COLOR, FONT, SCENE_FRAMES } from './theme';
import { SceneWordmark } from './scenes/SceneWordmark';
import { SceneRecordVoice } from './scenes/SceneRecordVoice';
import { SceneRecording } from './scenes/SceneRecording';
import { SceneStructured } from './scenes/SceneStructured';
import { SceneDailyRecord } from './scenes/SceneDailyRecord';
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

  // Focused canvas — ~4:5 aspect, ~75% of vertical frame, balanced padding
  let canvasW: number;
  let canvasH: number;
  if (orientation === 'vertical') {
    // 1080x1920: target ~75% height, 4:5 aspect
    canvasH = Math.round(height * 0.76);
    canvasW = Math.min(Math.round(canvasH * (4 / 5)), width - 80);
  } else {
    // 1920x1080: leave breathing room top/bottom, 4:5 aspect
    canvasH = Math.round(height * 0.84);
    canvasW = Math.round(canvasH * (4 / 5));
  }

  // Internal UI is designed at canvas aspect (4:5) so all chrome (status bar, header,
  // bottom nav) fits cleanly without clipping.
  const designW = 1080;
  const designH = 1350;
  const scale = canvasW / designW;
  const innerOffsetY = 0;

  return (
    <AbsoluteFill
      style={{
        background: COLOR.bg,
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
          borderRadius: 28,
          border: `1px solid ${COLOR.border}`,
          boxShadow: `0 8px 28px -14px ${COLOR.shadow}, 0 2px 6px -2px ${COLOR.shadow}`,
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
  // 8-frame crossfade between scenes (subtle, calm)
  const t = () => ({
    presentation: fade(),
    timing: linearTiming({ durationInFrames: 8 }),
  });

  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.wordmark}>
          <PhoneFrame orientation={orientation}><SceneWordmark /></PhoneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.recordVoice}>
          <PhoneFrame orientation={orientation}><SceneRecordVoice /></PhoneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.recording}>
          <PhoneFrame orientation={orientation}><SceneRecording /></PhoneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.structured}>
          <PhoneFrame orientation={orientation}><SceneStructured /></PhoneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.daily}>
          <PhoneFrame orientation={orientation}><SceneDailyRecord /></PhoneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.timeline}>
          <PhoneFrame orientation={orientation}><SceneTimeline /></PhoneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.exportShare}>
          <PhoneFrame orientation={orientation}><SceneExport /></PhoneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t()} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.closing}>
          <PhoneFrame orientation={orientation}><SceneClosing /></PhoneFrame>
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
