import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
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
  if (orientation === 'vertical') {
    // Fill the full vertical canvas with the screen
    return (
      <AbsoluteFill style={{ background: COLOR.bg, fontFamily: FONT.ui, color: COLOR.text }}>
        {children}
      </AbsoluteFill>
    );
  }
  // Landscape: render a centered phone frame at 9:19.5 aspect, leaving subtle white margin
  const frameH = Math.min(height - 120, 980);
  const frameW = Math.round(frameH * (9 / 19.5));
  return (
    <AbsoluteFill style={{ background: COLOR.bg, justifyContent: 'center', alignItems: 'center', fontFamily: FONT.ui, color: COLOR.text }}>
      <div
        style={{
          width: frameW,
          height: frameH,
          background: COLOR.bg,
          borderRadius: 56,
          border: `2px solid ${COLOR.border}`,
          boxShadow: `0 30px 80px -30px ${COLOR.shadow}`,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {children}
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
