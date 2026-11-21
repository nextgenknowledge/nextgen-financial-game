'use client';
/**
 * Claim Denied? (Advanced, Insurance Office). You are the claims adjuster for a morning. Read the
 * actual policy wording and rule on five real-life claims: what is covered, what the deductible
 * takes, and why "replacement cost" and "actual cash value" are worth very different amounts.
 */
import type { KindProps } from '../../types';
import { usd } from '../pro/kit';
import { CaseRunner, Cards, Doc, Say, dial, pick, type CaseDef, type DocDef } from './kit';

interface S {
  repair: number;
  laptop: number;
}

const PHONE: DocDef = {
  title: 'Phone Protection Plan',
  sub: '$12 a month',
  skin: 'contract',
  lines: [
    { id: 'a', l: 'Covers: accidental damage, including drops and liquid' },
    { id: 'b', l: 'Covers: theft, with a police report filed within 48 hours' },
    { id: 'c', l: 'Does not cover: loss, or phones left unattended in a public place' },
    { id: 'd', l: 'Deductible: $99 per claim' },
  ],
};

const RENTERS: DocDef = {
  title: 'Renter’s Insurance Policy',
  sub: '$16 a month',
  skin: 'contract',
  lines: [
    { id: 'a', l: 'Covers your belongings against fire, smoke, theft and burst pipes, at home or away' },
    { id: 'b', l: 'Paid at actual cash value: what the item was worth when lost, after wear and age' },
    { id: 'c', l: 'Does not cover: flood, meaning rising water from outside the building' },
    { id: 'd', l: 'Deductible: $500 per claim' },
  ],
};

const CAR: DocDef = {
  title: 'Auto Policy: Declarations',
  sub: 'Driver aged 18',
  skin: 'contract',
  lines: [
    { id: 'a', l: 'Liability: $50,000 per person, $100,000 per accident (damage you cause to others)' },
    { id: 'b', l: 'Collision coverage (damage to your own car in a crash): NOT PURCHASED' },
    { id: 'c', l: 'Comprehensive (theft, hail, fallen trees): NOT PURCHASED' },
  ],
};

export default function ClaimDenied({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Insurance Office · Claim denied?',
    init: (rng) => ({ repair: rng.pick([259, 279, 319]), laptop: rng.pick([650, 700, 800]) }),
    steps: [
      ({ s }) =>
        dial({
          brief: `Claim 1. Lena dropped her phone on the sidewalk and shattered the screen. The repair shop quotes ${usd(s.repair)}.`,
          visual: <Doc doc={PHONE} />,
          prompt: 'How much does the insurer pay?',
          min: 0,
          max: 400,
          step: 1,
          answer: s.repair - 99,
          tol: 2,
          fmt: (v) => usd(v),
          why: `A drop is accidental damage, so it is covered, minus the $99 deductible: ${usd(s.repair)} − $99 = ${usd(s.repair - 99)}. Lena pays the first $99 herself. For a repair under $99, the plan would pay nothing at all.`,
        }),
      () =>
        pick({
          brief: 'Claim 2. Marcus left his phone on the seat of a bus. By the time he called, it was gone. He files a claim for theft.',
          visual: <Doc doc={PHONE} />,
          prompt: 'What is your ruling?',
          options: [
            { label: 'Denied. A phone left behind in public is loss, which the plan excludes', credit: 1, why: 'Theft means someone took it from you. Leaving it on a bus is loss under the policy’s own wording, and that is exactly the claim insurers check most closely.' },
            { label: 'Covered as theft, since someone took it', credit: 0.2, why: 'Someone probably did, but the policy specifically excludes phones left unattended in public.' },
            { label: 'Covered, minus the $99 deductible', credit: 0, why: 'The deductible only applies to covered claims. This one is excluded.' },
          ],
        }),
      ({ s }) =>
        dial({
          brief: `Claim 3. Jae’s laptop was stolen from his car at the gym. It cost $1,400 new three years ago; a similar used one today is worth about ${usd(s.laptop)}.`,
          visual: <Doc doc={RENTERS} />,
          prompt: 'How much does the renter’s policy pay?',
          min: 0,
          max: 1400,
          step: 25,
          answer: s.laptop - 500,
          tol: 25,
          fmt: (v) => usd(v),
          why: `Theft away from home is covered, but at actual cash value: ${usd(s.laptop)}, not the $1,400 it cost, minus the $500 deductible. That leaves ${usd(s.laptop - 500)}. A "replacement cost" policy, usually a few dollars more a month, would have paid what a new laptop costs.`,
        }),
      () =>
        pick({
          brief: 'Claim 4. After three days of heavy rain, the river overflows and water pours into Priya’s ground-floor apartment, ruining her furniture.',
          visual: <Doc doc={RENTERS} />,
          prompt: 'What is your ruling?',
          options: [
            { label: 'Denied. Rising water from outside is flood, which needs separate flood insurance', credit: 1, why: 'Standard renter’s and home policies exclude flood. People in flood-prone areas need a separate flood policy, and many do not find out until it is too late.' },
            { label: 'Covered; water damage is water damage', credit: 0, why: 'The policy covers water from a burst pipe inside, not flood water from outside. The source of the water decides the claim.' },
            { label: 'Covered at half value, as a compromise', credit: 0, why: 'Claims are decided by the policy wording, not split down the middle.' },
          ],
        }),
      () =>
        pick({
          brief: 'Claim 5. Theo, 18, slid on ice into a lamp post. Nobody else was involved. His own car needs $3,200 of repairs.',
          visual: <Doc doc={CAR} />,
          prompt: 'What does his insurer pay for his car?',
          options: [
            { label: 'Nothing. He only bought liability, which pays for damage to others, not his own car', credit: 1, why: 'Liability is the legal minimum, and it protects other people from you. Collision coverage is what fixes your own car, and Theo skipped it to save money.' },
            { label: 'All of it, because he is insured', credit: 0, why: '"Insured" depends on which coverages you buy. His policy says collision was not purchased.' },
            { label: 'The lamp post only', credit: 0.6, why: 'Right that liability covers the city’s lamp post, but the question was his own car, which gets nothing.' },
          ],
        }),
      () =>
        pick({
          brief: 'End of your shift. A new customer asks how to avoid all five of these surprises.',
          visual: <Say who="Customer">Honestly, I never read the policy. Who does?</Say>,
          prompt: 'What is your best advice?',
          options: [
            { label: 'Read the exclusions and the deductible before buying, and choose coverage for the losses you could not afford yourself', credit: 1, why: 'Every denied claim today was written plainly in the policy. Insurance is for losses that would really hurt; small ones are often cheaper to pay yourself.' },
            { label: 'Buy every add-on offered, just in case', credit: 0.2, why: 'Over-insuring small things, like a $99-deductible phone plan on a cheap phone, can cost more than the risks.' },
            { label: 'Skip insurance and keep the money', credit: 0.1, why: 'Fine for small risks, dangerous for big ones like liability, fire or a car you could not replace.' },
          ],
        }),
    ],
    alts: {
      0: [
        ({ s }) =>
          dial({
            brief: `Claim 1. Sam’s phone fell into a swimming pool and will not turn on. A replacement of the same model costs ${usd(s.repair + 120)}.`,
            visual: <Doc doc={PHONE} />,
            prompt: 'How much does the insurer pay?',
            min: 0,
            max: 500,
            step: 1,
            answer: s.repair + 21,
            tol: 2,
            fmt: (v) => usd(v),
            why: `Liquid damage is accidental damage, so it is covered, minus the $99 deductible: ${usd(s.repair + 120)} − $99 = ${usd(s.repair + 21)}.`,
          }),
      ],
      1: [
        () =>
          pick({
            brief: 'Claim 2. Dani’s phone was snatched from her hand on the street. She was too shaken to do anything that week and reported it to the police five days later.',
            visual: <Doc doc={PHONE} />,
            prompt: 'What is your ruling?',
            options: [
              { label: 'Denied. Theft is covered only with a police report filed within 48 hours', credit: 1, why: 'It really was theft, but the policy sets a condition. Missing a deadline in the wording can sink a valid claim, so report thefts right away.' },
              { label: 'Covered, minus the $99 deductible, since it was clearly theft', credit: 0.3, why: 'Fair in spirit, but the policy requires the report within 48 hours.' },
              { label: 'Denied, because phones are never covered for theft', credit: 0, why: 'This plan does cover theft, with a condition that was not met.' },
            ],
          }),
      ],
      2: [
        ({ s }) =>
          dial({
            brief: `Claim 3. A kitchen fire ruins Kofi’s sofa and desk. They cost $2,000 new four years ago; today they are worth about ${usd(s.laptop + 300)}.`,
            visual: <Doc doc={RENTERS} />,
            prompt: 'How much does the renter’s policy pay?',
            min: 0,
            max: 2000,
            step: 25,
            answer: s.laptop - 200,
            tol: 25,
            fmt: (v) => usd(v),
            why: `Fire is covered at actual cash value: ${usd(s.laptop + 300)}, minus the $500 deductible, leaves ${usd(s.laptop - 200)}. Replacing them new would cost far more.`,
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'Claim 4. A pipe bursts inside the wall of Rosa’s apartment during a freeze. Water soaks her rug, books and laptop, worth $1,800 in total at actual cash value.',
            visual: <Doc doc={RENTERS} />,
            prompt: 'What is your ruling?',
            options: [
              { label: 'Covered: $1,800 minus the $500 deductible, so $1,300', credit: 1, why: 'A burst pipe is named in the policy. The water came from inside the building, so it is not flood.' },
              { label: 'Denied as flood', credit: 0, why: 'Flood means rising water from outside. This came from a pipe inside.' },
              { label: 'Covered in full, $1,800', credit: 0.4, why: 'Covered, but the $500 deductible still comes off.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'Claim 5. Theo, 18, rear-ends another car at a light. The other car needs $4,000 of repairs; his own needs $2,000.',
            visual: <Doc doc={CAR} />,
            prompt: 'What does his insurer pay?',
            options: [
              { label: 'The $4,000 for the other car, under liability. Nothing for his own car', credit: 1, why: 'Liability pays for damage he causes to others. Without collision coverage, his own repairs are his to pay.' },
              { label: 'All $6,000', credit: 0, why: 'He did not buy collision, so his own car is not covered.' },
              { label: 'Nothing, because the crash was his fault', credit: 0, why: 'Liability exists exactly for crashes that are your fault.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'A customer is choosing a car insurance deductible. They have $1,500 in an emergency fund.',
            visual: <Cards cards={[{ icon: '🚗', title: '$250 deductible', facts: [['Premium', '$190 a month']] }, { icon: '🚗', title: '$1,000 deductible', facts: [['Premium', '$150 a month']] }]} />,
            prompt: 'What is your advice?',
            options: [
              { label: 'The $1,000 deductible. Their fund can cover it, and they save $480 a year', credit: 1, why: 'A higher deductible lowers the premium. If you can afford the deductible from savings, you usually come out ahead over time.' },
              { label: 'The $250 deductible, to pay as little as possible after a crash', credit: 0.4, why: 'Less to pay after a crash, but $480 more every year whether you crash or not.' },
              { label: 'Skip insurance entirely', credit: 0, why: 'Driving without liability insurance is illegal almost everywhere, and a serious crash could cost far more than any fund.' },
            ],
          }),
      ],
    },
    takeaways: [
      'The deductible comes off every claim. Small damage can be worth nothing to claim.',
      'Exclusions decide claims: loss is not theft, and flood is not a burst pipe.',
      'Actual cash value pays what an item is worth now. Replacement cost pays what a new one costs.',
      'Liability protects others from you. Collision and comprehensive protect your own car.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
