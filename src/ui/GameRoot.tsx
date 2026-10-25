'use client';
import { useEffect } from 'react';
import { useUI } from '@/store/ui';
import { useSettings } from '@/store/settings';
import { setEffectHandler } from '@/store/game';
import { installInput } from '@/engine/input';
import { setVolumes } from '@/engine/audio';
import { IntroScreen, TitleScreen, CreditsScreen } from './screens/TitleScreens';
import { WorldsScreen } from './screens/WorldsScreen';
import { playEffects } from './effects';
import { Toasts } from './Toasts';
import { LoadingScreen } from './loading/LoadingScreen';
import { ORG_LOGO } from './common';
import GameView from './GameView';
import { Confetti } from './Confetti';

export default function GameRoot() {
  const screen = useUI((s) => s.screen);
  const loaded = useSettings((s) => s.loaded);
  const music = useSettings((s) => s.music);
  const sfx = useSettings((s) => s.sfx);

  useEffect(() => {
    useSettings.getState().load();
    setEffectHandler(playEffects);
    installInput();
    if (process.env.NODE_ENV !== 'production') {
      // Dev-only debug handle for automated checks
      Promise.all([import('@/engine/runtime'), import('@/store/game'), import('@/store/scene')]).then(([r, g, sc]) => {
        (window as unknown as Record<string, unknown>).__fc = { rt: r.rt, game: g.useGame, ui: useUI, scene: sc.useScene, act: g.act, settings: useSettings };
      });
    }
  }, []);
  useEffect(() => setVolumes(music, sfx), [music, sfx]);

  if (!loaded) return <div className="boot-blank" />;
  return (
    <>
      {screen === 'intro' && <IntroScreen />}
      {screen === 'title' && <TitleScreen />}
      {screen === 'worlds' && <WorldsScreen />}
      {screen === 'credits' && <CreditsScreen />}
      {screen === 'game' && <GameView />}
      <LoadingOverlay />
      {screen !== 'game' && <Toasts />}
      <Confetti />
    </>
  );
}

function LoadingOverlay() {
  const loading = useUI((s) => s.loading);
  if (!loading.active) return null;
  return <LoadingScreen loading={loading} />;
}

