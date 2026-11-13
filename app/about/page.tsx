import type { Metadata } from 'next';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const TITLE = 'About Fin City (FinCity) | Free Financial Literacy Game';
const DESCRIPTION =
  'What Fin City is, what kids and teens learn, and how to play. A free 3D financial literacy game for ages 6 to 18 that runs in your browser.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about/' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: 'https://fincity.dev/about/', siteName: 'Fin City', type: 'website', images: ['/share.jpg'] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/share.jpg'] },
};

export default function AboutPage() {
  return (
    <main className="about-page">
      <div className="about-inner">
        <img className="about-logo" src={`${BASE}/brand/fin-city-logo.webp`} alt="Fin City logo" width={160} height={160} />
        <h1>Fin City: a free financial literacy game for kids and teens</h1>
        <p>
          Fin City, also written FinCity, is a free 3D money game for ages 6 to 18. It plays right in your browser, with no
          download and no account. Instead of reading about money, players learn by making decisions and seeing what happens.
        </p>
        <a className="btn big about-play" href={`${BASE}/`}>Play Fin City</a>

        <h2>What players learn</h2>
        <ul>
          <li>Budgeting and saving</li>
          <li>Banking and credit</li>
          <li>Taxes</li>
          <li>Investing</li>
        </ul>

        <h2>Five cities to explore</h2>
        <p>
          Players explore San Francisco, New York, London, Hong Kong and Singapore. They step inside buildings and take on
          more than 40 kinds of activities, quests and challenges, each built around a real money skill, while earning, budgeting,
          saving and investing in a simulated financial life of their own.
        </p>

        <h2>Two modes for ages 6 to 18</h2>
        <p>
          Entry mode (ages 6 to 13) has big buttons, read-aloud and generous hints. Advanced mode (ages 13 to 18) uses real
          calculations, taxes, credit scores and markets.
        </p>

        <h2>For teachers and parents</h2>
        <p>
          You can download a progress report from the pause menu. Fin City runs on Chromebooks too, with Low, Medium and High
          quality settings. Progress saves in the player&apos;s own browser and can be exported as a file.
        </p>

        <h2>Who made it</h2>
        <p>
          Fin City is made by <a href="https://nextgenknowledge.org">NextGen Knowledge</a>, a student-led organization that makes
          real-world financial literacy free and accessible. The game has officially launched, and we keep adding to it.{' '}
          <a href="https://nextgenknowledge.org/fin-city.html#feedback">Send us feedback</a>.
        </p>
      </div>
    </main>
  );
}
