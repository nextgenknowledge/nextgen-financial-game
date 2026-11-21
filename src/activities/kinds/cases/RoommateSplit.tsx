'use client';
/**
 * Roommate Split (Advanced, Rent or Buy Office). Three friends, one flat, three unequal rooms.
 * Split the rent fairly, write the house agreement before anyone moves in, and work out what a
 * parent signs up for as a guarantor.
 */
import type { KindProps } from '../../types';
import { Table } from '../pro/kit';
import { CaseRunner, Cards, Feed, dial, flag, pick, type CaseDef } from './kit';

const gbp = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`;

interface S {
  rent: number;
  rooms: [number, number, number];
}

export default function RoommateSplit({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Rent or Buy Office · Roommate split',
    init: (rng) => ({ rent: rng.pick([1800, 1950, 2100]), rooms: rng.pick([[16, 12, 10], [18, 12, 10], [15, 13, 9]]) as [number, number, number] }),
    steps: [
      ({ s }) => {
        const tot = s.rooms[0] + s.rooms[1] + s.rooms[2];
        return dial({
          brief: `You, Priya and Tom find a three-bed flat for ${gbp(s.rent)} a month. The bedrooms are not equal, so you agree to split the rent by bedroom size.`,
          visual: <Cards cards={[{ icon: '🛏️', title: 'Room A', sub: 'Big, bay window', facts: [['Size', `${s.rooms[0]} m²`]] }, { icon: '🛏️', title: 'Room B', sub: 'Medium', facts: [['Size', `${s.rooms[1]} m²`]] }, { icon: '🛏️', title: 'Room C', sub: 'Box room', facts: [['Size', `${s.rooms[2]} m²`]] }]} />,
          prompt: 'How much should Room A pay each month?',
          min: 0,
          max: 1200,
          step: 5,
          answer: Math.round((s.rent * s.rooms[0]) / tot),
          tol: 10,
          fmt: (v) => gbp(v),
          why: `The rooms total ${tot} m². Room A is ${s.rooms[0]} of them: ${gbp(s.rent)} × ${s.rooms[0]} ÷ ${tot} = ${gbp((s.rent * s.rooms[0]) / tot)}. Room C pays ${gbp((s.rent * s.rooms[2]) / tot)}. Splitting equally would have had the box room paying ${gbp(s.rent / 3 - (s.rent * s.rooms[2]) / tot)} a month for space someone else uses.`,
        });
      },
      () =>
        pick({
          brief: 'Then you notice Room B has its own bathroom. Room A and Room C share the other one.',
          prompt: 'What is the fairest fix?',
          options: [
            { label: 'Agree a set amount Room B pays for the bathroom, and write it down before anyone signs', credit: 1, why: 'Any reasonable formula works if everyone agrees to it up front. The fight happens when it is decided after someone has already picked their room.' },
            { label: 'Whoever gets there first picks a room, and the rent stays split by size', credit: 0.2, why: 'Fast, but someone ends up paying the same as a person with a private bathroom. That resentment lasts all year.' },
            { label: 'Split the rent equally instead; it all evens out', credit: 0.3, why: 'It evens out for the person in the best room. Equal splits only work when rooms are close to equal.' },
          ],
        }),
      ({ s }) =>
        flag({
          brief: 'Priya drafts a house agreement. Nobody wants to be the awkward one, but everyone signs it.',
          prompt: 'Flag the clauses that are likely to cause money problems later.',
          doc: {
            title: 'Flat 4 House Agreement',
            sub: 'Draft 1',
            skin: 'paper',
            lines: [
              { id: 'split', l: `Rent split by room size, with £40 a month extra for Room B's bathroom.` },
              { id: 'dep', l: `Tom will pay the whole ${gbp(s.rent * 1.15)} deposit for now and we will sort out our shares later.` },
              { id: 'bills', l: 'All bills are in Priya’s name. Everyone pays Priya back whenever they can.' },
              { id: 'clean', l: 'Cleaning rota: kitchen and bathroom weekly, swapped each Sunday.' },
              { id: 'guest', l: 'Partners can stay over as often as they like.' },
              { id: 'quiet', l: 'Quiet after 11 pm on weeknights.' },
              { id: 'leave', l: 'If someone wants to leave, they should give a bit of notice.' },
            ],
          },
          issues: {
            dep: '"Later" never comes. If Tom leaves first, who owns which part of the deposit? Everyone pays their share before moving in, and the amounts are written down.',
            bills: 'Priya’s credit is on the line for everyone’s usage, with no deadline for repayment. Agree a fixed date each month, or use a bill-splitting account.',
            guest: 'A partner staying five nights a week uses heating, water and space. Agree a limit, or a contribution once it passes a set number of nights.',
            leave: '"A bit of notice" means nothing when the tenancy says everyone owes the rent. Agree that a leaver keeps paying until a replacement the others accept moves in.',
          },
          fine: {
            split: 'Specific, agreed and written down. Exactly how it should look.',
            clean: 'Not about money, but rotas head off the biggest daily argument.',
            quiet: 'A reasonable rule with no cost attached.',
          },
        }),
      () =>
        pick({
          brief: 'The letting agent asks each of you for a UK guarantor: someone who promises to pay if you do not. Your dad is ready to sign.',
          visual: <Table head={['Guarantor agreement, clause 3', '']} rows={[['The Guarantor guarantees the payment of all rent due under the tenancy, and the performance of all tenants’ obligations.', '']]} />,
          prompt: 'What is your dad actually agreeing to?',
          options: [
            { label: 'Possibly the rent of all three of you, not just yours, because it says "all rent" under a joint tenancy', credit: 1, why: 'On a joint tenancy, an unlimited guarantee can cover the whole flat. If Tom stops paying, the agent can chase your dad. Ask for the guarantee to be capped at your share.' },
            { label: 'Just your share of the rent', credit: 0.2, why: 'That is what most people assume, and only true if the agreement says so. This one does not.' },
            { label: 'Nothing unless you are evicted', credit: 0, why: 'A guarantor can be asked to pay as soon as rent is missed.' },
          ],
        }),
      () =>
        pick({
          brief: 'Month seven. Tom gets a job in Manchester and wants to leave in two weeks. The tenancy has five months left.',
          visual: <Feed title="Flat 4" posts={[{ who: 'Tom', text: 'Sorry guys, it is a dream job. I will try to find someone?' }, { who: 'Priya', text: 'Who pays your room until then??' }]} />,
          prompt: 'What is the best way through it?',
          options: [
            { label: 'Tom keeps paying his share until a replacement you all accept moves in, and the agent approves the swap in writing', credit: 1, why: 'Under a joint tenancy, the landlord can ask any of you, or your guarantors, for Tom’s share. Making his share his job, and getting the swap approved, protects everyone.' },
            { label: 'Tom stops paying; you and Priya split his room', credit: 0.2, why: 'Generous, but that is an extra third of the rent each, for months, for a room you do not use.' },
            { label: 'Let a friend of Tom’s move in informally', credit: 0.1, why: 'Someone not on the tenancy has no duty to the landlord. If they stop paying, the debt is still yours.' },
          ],
        }),
    ],
    alts: {
      0: [
        ({ s }) => {
          const tot = s.rooms[0] + s.rooms[1] + s.rooms[2];
          const c = (s.rent * 0.4) / 3 + (s.rent * 0.6 * s.rooms[2]) / tot;
          return dial({
            brief: `You, Priya and Tom rent a three-bed flat for ${gbp(s.rent)} a month. You agree that 40% of the rent pays for the shared kitchen and living room, split equally, and 60% pays for the bedrooms, split by size.`,
            visual: <Table head={['Bedroom', 'Size']} rows={[['Room A', `${s.rooms[0]} m²`], ['Room B', `${s.rooms[1]} m²`], ['Room C', `${s.rooms[2]} m²`]]} />,
            prompt: 'How much should Room C pay each month?',
            min: 0,
            max: 1200,
            step: 5,
            answer: Math.round(c),
            tol: 10,
            fmt: (v) => gbp(v),
            why: `Shared part: ${gbp(s.rent * 0.4)} ÷ 3 = ${gbp((s.rent * 0.4) / 3)}. Bedroom part: ${gbp(s.rent * 0.6)} × ${s.rooms[2]} ÷ ${tot} = ${gbp((s.rent * 0.6 * s.rooms[2]) / tot)}. Together, ${gbp(c)}. Splitting the shared space equally is fair because everyone uses it the same.`,
          });
        },
      ],
      1: [
        () =>
          pick({
            brief: 'The flat comes with one parking space. Only Tom has a car. Parking nearby costs about £60 a month.',
            prompt: 'What is the fairest way to handle it?',
            options: [
              { label: 'Tom pays an agreed amount for the space on top of his rent share, written into the house agreement', credit: 1, why: 'The space has real value and only one person uses it. Agreeing a price up front stops it becoming a grudge.' },
              { label: 'Nobody pays for it; it came with the flat', credit: 0.3, why: 'It came with the rent everyone pays. Tom gets £60 a month of value the others fund.' },
              { label: 'Rent the space to a stranger instead', credit: 0.2, why: 'Possible if the tenancy allows it, but it leaves Tom paying for parking elsewhere and may break the lease.' },
            ],
          }),
      ],
      2: [
        ({ s }) =>
          flag({
            brief: 'Tom writes a second draft of the house agreement.',
            prompt: 'Flag the clauses that are likely to cause money problems later.',
            doc: {
              title: 'Flat 4 House Agreement',
              sub: 'Draft 2',
              skin: 'paper',
              lines: [
                { id: 'dep', l: `Each person pays one third of the ${gbp(s.rent * 1.15)} deposit before moving in.` },
                { id: 'food', l: 'All food is shared. Everyone buys whatever they like on the house card.' },
                { id: 'net', l: 'Broadband is in Tom’s name. He will ask for money when he needs it.' },
                { id: 'clean', l: 'A cleaner comes fortnightly; the £40 is split three ways.' },
                { id: 'dmg', l: 'Damage: whoever caused it pays. If nobody owns up, we decide then.' },
                { id: 'due', l: 'Rent shares are paid into the rent account by the 25th of each month.' },
              ],
            },
            issues: {
              food: 'Sharing everything means the person who eats least pays for the person who eats most. A shared basics list plus separate food is fairer.',
              net: '"When he needs it" means awkward reminders and unequal tabs. Set a fixed amount and date.',
              dmg: 'Leaving it to "decide then" means deciding during an argument. Agree now: unexplained damage is split equally.',
            },
            fine: {
              dep: 'Everyone pays their share up front, in writing.',
              clean: 'A clear cost, split clearly.',
              due: 'A fixed date before rent is due is exactly right.',
            },
          }),
      ],
      3: [
        ({ s }) =>
          pick({
            brief: `The letting agent asks for the ${gbp(s.rent * 1.15)} deposit in cash and says there is no need for a receipt. "We keep it safe ourselves," she says.`,
            prompt: 'What should you do?',
            options: [
              { label: 'Pay by bank transfer, get a receipt, and check the deposit is registered in a government-approved protection scheme', credit: 1, why: 'In England, landlords must protect deposits in an approved scheme within 30 days and tell you which one. It keeps your money safe and gives you a free way to settle disputes.' },
              { label: 'Pay cash; it is quicker', credit: 0, why: 'Cash with no receipt leaves you no proof you paid at all.' },
              { label: 'Pay, and ask about the scheme when you move out', credit: 0.2, why: 'Too late by then. Check within the first month.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'Month five. Priya loses her job and says she cannot pay her share for the next two months.',
            visual: <Feed title="Flat 4" posts={[{ who: 'Priya', text: 'I am so sorry. I have interviews lined up, I just need a bit of time.' }]} />,
            prompt: 'What is the best way through it?',
            options: [
              { label: 'Talk openly, cover what you can short term, and write down a repayment plan Priya agrees to', credit: 1, why: 'On a joint tenancy the landlord can chase any of you for the full rent, so the rent must be paid. A written plan keeps it fair and keeps the friendship.' },
              { label: 'Let the rent go short and let the landlord deal with Priya', credit: 0, why: 'Under a joint tenancy, a shortfall is everyone’s debt, and your guarantors can be chased.' },
              { label: 'Ask Priya to move out immediately', credit: 0.2, why: 'Her name is on the tenancy, so she still owes rent until a replacement is agreed. It also ends a friendship over two months.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Split rent by what each person gets, and agree the formula before anyone picks a room.',
      'Write down deposits, bill deadlines, guests and what happens when someone leaves.',
      'On a joint tenancy, everyone can be chased for the whole rent, and so can their guarantors.',
      'Ask for a guarantee to be capped at your own share.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
