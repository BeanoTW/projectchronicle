import React from 'react';
import { Composition } from 'remotion';
import { MainVideo } from './MainVideo';
import { TOTAL_FRAMES, FPS } from './theme';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="vertical"
      component={MainVideo as any}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ orientation: 'vertical' as const }}
    />
    <Composition
      id="landscape"
      component={MainVideo as any}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ orientation: 'landscape' as const }}
    />
  </>
);
