'use client';
/**
 * Deepfake Desk (Advanced, Cyber Lab). Modern scams aimed at teenagers and young adults: a cloned
 * voice, a fake recruiter, a ticket resale, a celebrity crypto giveaway and an "easy money" job
 * that turns you into a money mule. Spot the tell, and know the move that protects you.
 */
import type { KindProps } from '../../types';
import { CaseRunner, Cards, Feed, Say, choose, flag, pick, type CaseDef } from './kit';

type S = Record<string, never>;

export default function DeepfakeDesk({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Cyber Lab · Deepfake desk',
    init: () => ({}),
    steps: [
      () =>
        pick({
          brief: 'Your phone rings from an unknown number. It is your mom’s voice, crying. "I have been in an accident, I need $900 for the tow and the hospital, please send it now, do not call Dad, he will be so angry."',
          visual: <Say who="The caller">Please hurry. Send it to this payment app account. I will explain later.</Say>,
          prompt: 'What do you do?',
          options: [
            { label: 'Hang up and call Mom on her own number, or ask a question only she could answer', credit: 1, why: 'A few seconds of audio from social media is enough to clone a voice. Urgency, secrecy and an unusual payment method are the tells. Calling back on a number you already have defeats it every time.' },
            { label: 'Send it. It is definitely her voice', credit: 0, why: 'Voices can now be copied convincingly. The voice is no longer proof of who is speaking.' },
            { label: 'Send half now and the rest once she explains', credit: 0, why: 'Half of a scam is still a scam. Verify first, always.' },
            { label: 'Call Dad, as she asked you not to', credit: 0.8, why: 'Good instinct: breaking the secrecy is exactly right. Calling Mom directly is faster still.' },
          ],
        }),
      () =>
        flag({
          brief: 'A recruiter messages you about a remote job.',
          prompt: 'Flag the signs this is a fake job.',
          doc: {
            title: 'Remote Data Entry Assistant',
            sub: 'Message from "Talent Team, Brightline Corp"',
            skin: 'screen',
            lines: [
              { id: 'pay', l: '$35 an hour, no experience needed, start tomorrow.' },
              { id: 'chat', l: 'Interview is by text chat only. No video call needed.' },
              { id: 'check', l: 'We will mail you a $2,400 check to buy equipment from our approved vendor. Send the vendor the money by payment app.' },
              { id: 'email', l: 'Contact: brightline.hiring.team@freemail.com' },
              { id: 'hours', l: 'Flexible hours, 20 to 30 a week.' },
              { id: 'ssn', l: 'Please send a photo of your ID and your bank login so we can set up direct deposit.' },
            ],
          },
          issues: {
            pay: 'High pay for no skills and no wait is how fake jobs get attention.',
            chat: 'Real employers want to see who they are hiring. Text-only interviews hide who is on the other end.',
            check: 'The classic fake check scam: the check bounces days later, after your payment app money has gone, and the bank takes it back from you.',
            email: 'A real company recruits from its own email domain, not a free account.',
            ssn: 'No employer needs your bank password. Direct deposit only needs account and routing numbers, and ID checks happen after a real offer.',
          },
          fine: {
            hours: 'Flexible part-time hours are normal for real remote jobs too.',
          },
        }),
      () =>
        pick({
          brief: 'Your favorite band’s show sold out. Someone in a fan group is selling two tickets at face value.',
          visual: <Feed posts={[{ who: 'Jess', handle: '@jess_tickets', text: 'Cannot go anymore :( 2 tickets at face value! Only take friends-and-family payment, platform fees are crazy. DM me fast, lots of interest!', meta: 'Account created 6 days ago' }]} />,
          prompt: 'What is the safest way to buy?',
          options: [
            { label: 'Only through the official resale exchange, or a payment method with buyer protection, never friends-and-family', credit: 1, why: 'Friends-and-family payments have no protection. Fake tickets, or the same real ticket sold to ten people, are the most common scam in fan groups.' },
            { label: 'Ask for a screenshot of the tickets first, then pay by friends-and-family', credit: 0.1, why: 'Screenshots are easily faked or sold to many buyers at once.' },
            { label: 'Pay, since it is only face value, not a crazy markup', credit: 0, why: 'Fair prices make scams more believable, not less.' },
          ],
        }),
      () =>
        pick({
          brief: 'A video goes viral: a famous tech billionaire, live, saying he will double any crypto sent to an address on screen, for the next 30 minutes only.',
          visual: <Cards cards={[{ icon: '📺', title: 'LIVE: Crypto Giveaway', sub: '41,000 watching', tag: 'Live', facts: [['Send', '0.1 to 5 coins'], ['Receive', 'Double, instantly'], ['Time left', '28:41']] }]} />,
          prompt: 'What is happening?',
          options: [
            { label: 'A deepfake or replayed video on a hijacked channel. Nobody gives away money by asking you to send money first', credit: 1, why: 'Every "send to receive" giveaway is a scam. Crypto payments cannot be reversed, which is why scammers love them, and the countdown stops you from checking.' },
            { label: 'A real promotion; billionaires do this for publicity', credit: 0, why: 'They do not. And if they did, they would not need your coins first.' },
            { label: 'Probably fake, but worth sending a small amount to test it', credit: 0.1, why: 'The small amount is simply lost. There is nothing to test.' },
          ],
        }),
      () =>
        pick({
          brief: 'A classmate offers you $200 to let a "friend’s business" send $3,000 into your bank account. You just withdraw it and hand it over in cash.',
          prompt: 'What is really being asked?',
          options: [
            { label: 'To act as a money mule: moving stolen money through your account. It is a crime, and the account in your name is the one that is caught', credit: 1, why: 'Criminals need clean accounts to move stolen money. Mules can have their bank accounts closed, struggle to open new ones for years, and face prosecution.' },
            { label: 'An easy $200 favor', credit: 0, why: 'Easy for them. Your name is on every transaction.' },
            { label: 'Fine, as long as you do not ask where the money came from', credit: 0, why: 'Not asking does not protect you; banks and police follow the account, not the story.' },
          ],
        }),
      () =>
        choose({
          brief: 'Your younger brother just got his first bank card and phone.',
          prompt: 'Which two habits would stop almost every scam in this case?',
          k: 2,
          options: [
            { label: 'When a message is urgent and secret, stop and verify through a number or website you already know', good: true, why: 'Urgency and secrecy are in every scam above. Verifying on your own channel breaks them all.' },
            { label: 'Never pay by gift card, crypto, wire or friends-and-family to someone you have not met', good: true, why: 'Scammers choose payments that cannot be reversed. Real businesses do not insist on them.' },
            { label: 'Trust it if the voice or video looks real', good: false, why: 'Voices and videos can now be faked convincingly.' },
            { label: 'Trust accounts with lots of followers', good: false, why: 'Followers can be bought, and real accounts can be hacked.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'You work part time at a bike shop. A video call comes in from your manager’s account. The face and voice look right. "I am stuck in a meeting. Buy five $100 gift cards for a client, send me the codes, and I will pay you back tonight. Keep it quiet."',
            prompt: 'What do you do?',
            options: [
              { label: 'End the call and contact your manager another way you already know, such as their phone number or in person', credit: 1, why: 'Video and voice can now be faked in real time. Gift cards, secrecy and urgency are the tells. Checking on a channel you trust ends it.' },
              { label: 'Buy them. You saw their face', credit: 0, why: 'A face on a screen is no longer proof of who is speaking.' },
              { label: 'Buy one card first to test it', credit: 0, why: 'There is nothing to test. The money is simply gone.' },
            ],
          }),
      ],
      1: [
        () =>
          flag({
            brief: 'An email says you have won a scholarship you do not remember applying for.',
            prompt: 'Flag the signs this is a scam.',
            doc: {
              title: 'Congratulations, Scholar!',
              sub: 'From "National Future Leaders Fund"',
              skin: 'screen',
              lines: [
                { id: 'won', l: 'You have been selected for a $5,000 scholarship.' },
                { id: 'fee', l: 'To release your award, pay a $95 processing fee by gift card.' },
                { id: 'time', l: 'This offer expires in 24 hours.' },
                { id: 'bank', l: 'Reply with your bank login so we can deposit the award.' },
                { id: 'use', l: 'Funds can be used for tuition or books.' },
                { id: 'mail', l: 'Award letters are sent by email.' },
              ],
            },
            issues: {
              won: 'Real scholarships require an application. Winning one you never applied for is the bait.',
              fee: 'Real scholarships never charge a fee to pay you, and never by gift card.',
              time: 'A tight deadline is there to stop you checking.',
              bank: 'Nobody needs your bank password to send you money.',
            },
            fine: {
              use: 'Normal wording for a real scholarship.',
              mail: 'Real awards are often sent by email too.',
            },
          }),
      ],
      2: [
        () =>
          pick({
            brief: 'You find a used phone online for a good price. The seller says lots of people want it and asks for a $100 deposit by payment app to hold it until you meet.',
            prompt: 'What is the safest move?',
            options: [
              { label: 'Pay nothing up front. Meet in a busy public place, check the phone works, then pay', credit: 1, why: 'A deposit to "hold" an item is a common trick. Many such sellers disappear with the deposit.' },
              { label: 'Pay the deposit so you do not lose it', credit: 0, why: 'You might lose $100 and still have no phone.' },
              { label: 'Pay the full price now to be safe', credit: 0, why: 'Paying in full before seeing an item from a stranger is the riskiest option.' },
            ],
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'A friendly stranger you met online shows you screenshots of big profits on a crypto trading app and helps you invest $300. Your balance in the app soon shows $900, but when you try to withdraw, the app demands a $200 "tax" first.',
            prompt: 'What is happening?',
            options: [
              { label: 'The app is fake. The balance is just a number on screen, and the "tax" is one more payment to the scammer', credit: 1, why: 'Fake profits build trust so you send more. Real platforms take taxes and fees from your balance, not as a separate payment to unlock it.' },
              { label: 'Pay the tax; you will still get $700', credit: 0, why: 'There will always be one more fee. The $900 does not exist.' },
              { label: 'Invest more so the withdrawal is worth it', credit: 0, why: 'That is exactly what the scammer wants.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'A text arrives: "Your bank: we have detected unusual activity. We just sent you a code. Reply with it to keep your account open."',
            prompt: 'What should you do?',
            options: [
              { label: 'Never share the code. Call your bank on the number on your card or in its app', credit: 1, why: 'One-time codes prove it is you. Anyone asking for one is trying to get into your account.' },
              { label: 'Reply with the code to avoid losing access', credit: 0, why: 'You would be handing a scammer the key to your account.' },
              { label: 'Click the link in the text to check', credit: 0.1, why: 'Links in unexpected texts often lead to fake bank pages.' },
            ],
          }),
      ],
      5: [
        () =>
          choose({
            brief: 'Your cousin just opened their first bank account and payment app.',
            prompt: 'Which two settings protect them most?',
            k: 2,
            options: [
              { label: 'Two-step login using an authenticator app or passkey', good: true, why: 'Even if someone steals the password, they cannot get in without the second step.' },
              { label: 'Alerts for every transaction on the bank account', good: true, why: 'Instant alerts mean fraud is spotted in minutes, not weeks.' },
              { label: 'The same strong password everywhere', good: false, why: 'One leak would unlock every account.' },
              { label: 'Posting their full birthday publicly', good: false, why: 'Birthdays are often used to verify identity.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Urgency, secrecy and unusual payment methods are the signature of a scam.',
      'A familiar voice or face is no longer proof. Verify through a channel you already trust.',
      'Payments that cannot be reversed, like gift cards, crypto and friends-and-family, are what scammers ask for.',
      'Letting someone move money through your account makes you part of the crime.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
