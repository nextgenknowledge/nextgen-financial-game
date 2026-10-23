'use client';

import dynamic from 'next/dynamic';

// The whole game is client-only (WebGL, IndexedDB, Web Audio, Web Speech).
const GameRoot = dynamic(() => import('@/ui/GameRoot'), {
  ssr: false,
  loading: () => <div className="boot-blank" />,
});

export default function Page() {
  return <GameRoot />;
}
