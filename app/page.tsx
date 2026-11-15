'use client';

import dynamic from 'next/dynamic';

// The whole game is client-only (WebGL, IndexedDB, Web Audio, Web Speech).
const GameRoot = dynamic(() => import('@/ui/GameRoot'), {
  ssr: false,
  loading: () => <div className="boot-blank" />,
});

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function Page() {
  return (
    <main className="game-main" aria-label="Fin City">
      {/* The game draws in 3D, so this describes it for screen readers and search engines */}
      <section className="sr-only">
        <h1>Fin City: a free financial literacy game for kids and teens</h1>
        <p>
          Fin City, also written FinCity, is a free 3D money game for ages 6 to 18 that plays in your browser, with no
          download or account. Explore San Francisco, New York, London, Hong Kong and Singapore, take on more than 40
          kinds of activities, and learn budgeting, saving, banking, credit, taxes and investing by running a financial life
          of your own. Made by NextGen Knowledge, a student-led financial literacy organization.
        </p>
        <p>
          Fin City is a game for learning, not financial advice. Prices, markets and returns in the game are simulated, and
          past performance does not guarantee future results.
        </p>
      </section>
      <GameRoot />
      <footer className="sr-only">
        <nav aria-label="Site links">
          <a href={`${BASE}/about/`}>About Fin City</a> <a href={`${BASE}/privacy/`}>Privacy policy</a>{' '}
          <a href={`${BASE}/terms/`}>Terms of use</a>{' '}
          <a href={`${BASE}/accessibility/`}>Accessibility</a> <a href={`${BASE}/privacy/#cookies`}>Cookie policy</a>{' '}
          <a href={`${BASE}/privacy/#deleting-data`}>Delete my data</a> <a href="https://nextgenknowledge.org">NextGen Knowledge</a>
        </nav>
        <p>© 2026 NextGen Knowledge. All rights reserved.</p>
      </footer>
    </main>
  );
}
