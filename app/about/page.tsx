import type { Metadata } from 'next';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const TITLE = 'About Fin City (FinCity) | Free Financial Literacy Game for Kids and Teens';
const DESCRIPTION =
  'Fin City is a free 3D financial literacy game for ages 6 to 18. Explore five cities and learn budgeting, saving, credit, taxes and investing. Works on Chromebooks, no account needed.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about/' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: 'https://fincity.dev/about/', siteName: 'Fin City', type: 'website', images: ['/share.jpg'] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/share.jpg'] },
};

const FAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    ['Is Fin City free?', 'Yes. Fin City is completely free, with no ads, no in-game purchases with real money and no account.'],
    ['What ages is Fin City for?', 'Ages 6 to 18. Entry mode is made for ages 6 to 13, and Advanced mode for ages 13 to 18.'],
    ['Does Fin City work on Chromebooks?', 'Yes. It runs in the browser on Chromebooks, laptops, phones and iPads, with no download.'],
    ['Does Fin City use real money?', 'No. Everything in the game uses simulated money, so players can make mistakes safely and learn from them.'],
  ].map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
};

export default function AboutPage() {
  return (
    <main className="about-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ) }} />
      <div className="about-inner">
        <img className="about-logo" src={`${BASE}/brand/fin-city-logo.webp`} alt="Fin City logo" width={160} height={160} />
        <h1>Fin City: a free financial literacy game for kids and teens</h1>
        <p>
          Fin City, also written FinCity, is a free 3D money game for ages 6 to 18. It plays right in your browser, with no
          download and no account. Instead of reading about money, players learn by making decisions and seeing what happens.
        </p>
        <a className="btn big about-play" href={`${BASE}/`}>Play Fin City</a>

        <h2>What players learn</h2>
        <p>
          Fin City teaches the money skills most students never get in school, by letting them practise with simulated money
          first. Players learn how to:
        </p>
        <ul>
          <li>Earn money, pick a career and understand a paycheck</li>
          <li>Make a budget and tell needs from wants</li>
          <li>Save for goals and see how compound interest grows money over time</li>
          <li>Use a bank account, and understand credit scores and borrowing</li>
          <li>Understand taxes and spot common scams</li>
          <li>Invest in stocks, bonds and index funds, and see how risk and diversification work</li>
          <li>Plan for the long term with insurance and saving</li>
        </ul>

        <h2>Five cities, each built around a money skill</h2>
        <p>
          Players walk through five real-world cities, step inside buildings and take on more than 40 kinds of activities,
          quests, challenges and seasonal events. Each run earns up to 3 stars.
        </p>
        <ul>
          <li><strong>San Francisco:</strong> earning, careers, taxes and spotting scams</li>
          <li><strong>New York:</strong> investing in stocks, bonds and index funds in a market that moves</li>
          <li><strong>London:</strong> budgeting and smart shopping</li>
          <li><strong>Hong Kong:</strong> business and trade</li>
          <li><strong>Singapore:</strong> saving, insurance and long-term planning</li>
        </ul>
        <p>
          Players are guided by NextGen Narwhal, the game&apos;s mascot, and can customize a character, own a home and adopt a pet
          as their simulated financial life grows.
        </p>

        <h2>Two levels for ages 6 to 18</h2>
        <p>
          <strong>Entry</strong> (ages 6 to 13) has big buttons, read-aloud and generous hints, so younger students can learn
          the basics. <strong>Advanced</strong> (ages 13 to 18) uses real calculations like compound interest, credit scores,
          taxes and P/E ratios, with professional-style desks for high school students.
        </p>

        <h2>For teachers and parents</h2>
        <p>
          Fin City is free, has no ads, needs no account and only asks for a nickname, never a real name. It runs in any web
          browser, including school Chromebooks, phones and iPads, with Low, Medium and High quality settings. Progress saves in
          the player&apos;s own browser and can be exported as a file, and you can download a progress report from the pause menu.
        </p>
        <p>
          Teachers can use our free <a href={`${BASE}/fin-city-teacher-guide.pdf`}>Fin City teacher guide (PDF)</a> to run it
          in class. If fincity.dev is blocked on your school network, ask your IT team to allow it; it is a new site, so some
          filters have not seen it yet.
        </p>

        <h2>In the news</h2>
        <p>
          Fin City was featured by BINJE in{' '}
          <a href="https://binje.com/sectors/finance/financial-literacy-why-four-bergen-county-juniors-built-game-to-teach-what-schools-often-dont/">
            Financial literacy: Why four Bergen County juniors built game to teach what schools often don&apos;t
          </a>{' '}
          (November 23, 2026).
        </p>

        <h2>Common questions</h2>
        <h3>Is Fin City free?</h3>
        <p>Yes. Fin City is completely free, with no ads, no in-game purchases with real money and no account.</p>
        <h3>What ages is Fin City for?</h3>
        <p>Ages 6 to 18. Entry mode is made for ages 6 to 13, and Advanced mode for ages 13 to 18.</p>
        <h3>Does Fin City work on Chromebooks?</h3>
        <p>Yes. It runs in the browser on Chromebooks, laptops, phones and iPads, with no download.</p>
        <h3>Does Fin City use real money?</h3>
        <p>No. Everything in the game uses simulated money, so players can make mistakes safely and learn from them.</p>

        <h2>Who made it</h2>
        <p>
          Fin City is made by <a href="https://nextgenknowledge.org">NextGen Knowledge</a>, a student-led organization that makes
          real-world financial literacy free and accessible. It was built by a team of high school students and launched publicly on
          November 8, 2026, and we keep adding new cities, events and features.{' '}
          <a href="https://nextgenknowledge.org/fin-city.html#feedback">Send us feedback</a>.
        </p>

        <h2>Not financial advice</h2>
        <p>
          Fin City is a game for learning. Prices, markets and returns in the game are simulated, and nothing in it is financial,
          investment or tax advice. Past performance, in the game or in real markets, does not guarantee future results.
        </p>

        <p>
          <a href={`${BASE}/privacy/`}>Privacy policy</a> · <a href={`${BASE}/terms/`}>Terms of use</a> ·{' '}
          <a href={`${BASE}/accessibility/`}>Accessibility</a>
        </p>
      </div>
    </main>
  );
}
