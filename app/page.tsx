'use client';

import dynamic from 'next/dynamic';

// The whole game is client-only (WebGL, IndexedDB, Web Audio, Web Speech).
const GameRoot = dynamic(() => import('@/ui/GameRoot'), {
  ssr: false,
  loading: () => <div className="boot-blank" />,
});

export default function Page() {
  return (
    <>
      {/* The game draws in 3D, so this describes it for screen readers and search engines */}
      <section className="sr-only">
        <h1>Fin City: a free financial literacy game for kids and teens</h1>
        <p>
          Fin City, also written FinCity, is a free 3D money game for ages 6 to 18 that plays in your browser, with no
          download or account. Explore San Francisco, New York, London, Hong Kong and Singapore, take on more than 40
          kinds of activities, and learn budgeting, saving, banking, credit, taxes and investing by running a financial life
          of your own. Made by NextGen Knowledge, a student-led financial literacy organization.
        </p>
      </section>
      <GameRoot />
    </>
  );
}
