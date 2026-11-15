import type { Metadata } from 'next';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const TITLE = 'Terms of Use | Fin City';
const DESCRIPTION = 'The rules for playing Fin City, the free financial literacy game from NextGen Knowledge.';
const UPDATED = 'November 15, 2026';
const CONTACT = 'nextgen.knowledge123@gmail.com';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/terms/' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: 'https://fincity.dev/terms/', siteName: 'Fin City', type: 'website', images: ['/share.jpg'] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/share.jpg'] },
};

export default function TermsPage() {
  return (
    <main className="about-page">
      <div className="about-inner">
        <h1>Terms of use</h1>
        <p className="muted">Last updated {UPDATED}</p>
        <p>
          By playing Fin City you agree to these terms. If you&apos;re under 18, please read them with a parent, guardian or
          teacher. Fin City is made by <a href="https://nextgenknowledge.org">NextGen Knowledge</a>, a student-led organization.
        </p>

        <h2>Free to play</h2>
        <p>
          Fin City is free. There are no accounts, ads, purchases or subscriptions, and the money in the game is pretend money
          that can never be turned into real money.
        </p>

        <h2>Nicknames and reviews</h2>
        <p>
          Pick a fun nickname, never your real name. Nicknames and reviews must be kind and appropriate for kids. We may hide or
          remove any nickname or review from the leaderboard or our feedback without warning.
        </p>

        <h2>Not financial advice</h2>
        <p>
          Fin City is a game for learning. Prices, markets, interest rates and returns in the game are simulated. Nothing in it is
          financial, investment, tax or legal advice, and past performance, in the game or in real markets, does not guarantee
          future results.
        </p>

        <h2>Fair play</h2>
        <p>Don&apos;t try to break, overload or cheat the game, the leaderboard or the feedback form.</p>

        <h2>Our content</h2>
        <p>
          The game, its artwork, music and the Fin City name belong to NextGen Knowledge. You&apos;re welcome to play it at home and
          in classrooms, but please don&apos;t copy, sell or republish it.
        </p>

        <h2>Your saves</h2>
        <p>
          Worlds are saved only in your browser. Clearing your browser&apos;s data deletes them, so export a world from the pause
          menu if you want a backup. We can&apos;t recover lost saves.
        </p>

        <h2>No warranty</h2>
        <p>
          We work hard to keep Fin City accurate and running, but it&apos;s provided as is, without guarantees. To the extent the
          law allows, NextGen Knowledge isn&apos;t responsible for losses that come from using the game or relying on it.
        </p>

        <h2>Privacy</h2>
        <p>
          How we handle information is explained in our <a href={`${BASE}/privacy/`}>privacy policy</a>.
        </p>

        <h2>Changes and contact</h2>
        <p>
          We may update these terms. When we do, we&apos;ll change the date at the top of this page. Questions can go to{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <p>
          <a href={`${BASE}/`}>Back to the game</a> · <a href={`${BASE}/about/`}>About Fin City</a> ·{' '}
          <a href={`${BASE}/privacy/`}>Privacy policy</a> ·{' '}
          <a href={`${BASE}/accessibility/`}>Accessibility</a>
        </p>
      </div>
    </main>
  );
}
