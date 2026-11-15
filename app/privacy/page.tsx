import type { Metadata } from 'next';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const TITLE = 'Privacy Policy | Fin City';
const DESCRIPTION = 'What Fin City saves, what it sends and what it never collects. No accounts, no ads and no chat.';
const UPDATED = 'November 15, 2026';
const CONTACT = 'nextgen.knowledge123@gmail.com';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/privacy/' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: 'https://fincity.dev/privacy/', siteName: 'Fin City', type: 'website', images: ['/share.jpg'] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/share.jpg'] },
};

export default function PrivacyPage() {
  return (
    <main className="about-page">
      <div className="about-inner">
        <h1>Privacy policy</h1>
        <p className="muted">Last updated {UPDATED}</p>
        <p>
          Fin City is a free financial literacy game made by <a href="https://nextgenknowledge.org">NextGen Knowledge</a>, a
          student-led organization. It is built for kids and teens, so it collects as little as possible. There are no accounts,
          no ads, no chat and no way for players to message each other.
        </p>

        <h2>What stays on your device</h2>
        <p>
          Your worlds, progress and settings are saved in your own browser. They are never uploaded to us. Clearing your
          browser&apos;s site data deletes them, and you can export a world as a file from the pause menu if you want a copy.
        </p>

        <h2>What we never ask for</h2>
        <p>
          Fin City never asks for a real name, email address, phone number, school, location or photo. Players pick a nickname
          instead, and we ask them not to use their real name.
        </p>

        <h2>The online leaderboard</h2>
        <p>
          On fincity.dev, each world&apos;s nickname, level, net worth and mode are sent to the online leaderboard as you play,
          along with a random ID for that world. These are kept in a Google Sheet run by NextGen Knowledge. You can stop sharing at
          any time in the Leaderboard app on the FinPhone. Turning it off removes that world from the board.
        </p>

        <h2>Ratings and feedback</h2>
        <p>
          If you choose to rate the game, your star rating, anything you type in the review box, your nickname and your mode are
          sent to a Google Form run by NextGen Knowledge. The feedback form on nextgenknowledge.org works the same way. Nothing
          else is sent with them.
        </p>

        <h2>Analytics</h2>
        <p>
          The live site uses Google Analytics to count visits and game milestones, such as finishing a first quiz. This helps us
          see what players enjoy and where they get stuck. Google Analytics uses cookies and sees basic device information like
          browser type and rough location. Advertising features and Google signals are turned off, and we never send your
          nickname, world name or answers. You can block it with your browser&apos;s privacy settings or an analytics blocker,
          and the game works the same.
        </p>

        <h2>Who we share information with</h2>
        <p>
          We do not sell or rent information, and we do not share it for advertising. The services above (Google Analytics,
          Google Sheets and Google Forms) and our host, Cloudflare, process data for us to run the site.
        </p>

        <h2>Children</h2>
        <p>
          Fin City is made for ages 6 to 18. Because it has no accounts and does not ask for personal information, children can
          play without sharing who they are. If you are a parent or teacher and think a child entered personal information, such
          as a real name as a nickname or in a review, email us and we will remove it.
        </p>

        <h2>Not financial advice</h2>
        <p>
          Fin City is a game for learning. Prices, markets, interest rates and returns in the game are simulated. Nothing in Fin
          City is financial, investment, tax or legal advice. Past performance, in the game or in real markets, does not
          guarantee future results.
        </p>

        <h2>Changes and contact</h2>
        <p>
          If this policy changes, we will update this page and the date at the top. Questions or removal requests can go to{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <p>
          <a href={`${BASE}/`}>Back to the game</a> · <a href={`${BASE}/about/`}>About Fin City</a> ·{' '}
          <a href={`${BASE}/terms/`}>Terms of use</a>
        </p>
      </div>
    </main>
  );
}
