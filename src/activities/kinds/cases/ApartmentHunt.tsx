'use client';
/**
 * First Apartment Hunt (Advanced, Real Estate). Choosing a first place on a starting salary:
 * the real monthly cost, the cash to move in, the lease clauses that bite, a roommate who stops
 * paying, and getting the deposit back.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Feed, dial, flag, pick, type CaseDef } from './kit';

interface S {
  rent: number;
  gross: number;
}

export default function ApartmentHunt({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Real Estate Office · First apartment hunt',
    init: (rng) => ({ rent: rng.pick([2000, 2100, 2200]), gross: 4200 }),
    steps: [
      ({ s }) =>
        pick({
          brief: `You start your first full-time job next month at ${usd(s.gross)} a month before tax, about $3,400 after. A common guideline is to keep housing near 30% of pay before tax.`,
          visual: (
            <Cards
              cards={[
                { icon: '🏢', title: 'The Studio', sub: 'On your own', facts: [['Rent', '$1,450'], ['Utilities', 'Included'], ['Commute', '10-minute walk'], ['Extras', 'None']] },
                { icon: '🏠', title: 'The Two-Bed', sub: 'Shared with a roommate', facts: [['Rent', `${usd(s.rent)}, split two ways`], ['Utilities', 'About $90 each'], ['Commute', '35 minutes by bus'], ['Extras', 'Bus pass $80']] },
                { icon: '🏙️', title: 'The Tower', sub: 'On your own', tag: 'Gym + pool', facts: [['Rent', '$1,900'], ['Utilities', 'About $110'], ['Commute', '15 minutes'], ['Extras', 'Amenity fee $75, parking $120']] },
              ]}
            />
          ),
          prompt: 'Which one fits your pay?',
          ordered: true,
          options: [
            { label: 'The Studio', credit: 0.5, why: `$1,450 all in is about 35% of pay before tax: over the guideline and tight, though it has no roommate risk and no commute cost.` },
            { label: 'The Two-Bed', credit: 1, why: `${usd(s.rent / 2)} rent plus $90 utilities and an $80 bus pass is ${usd(s.rent / 2 + 170)} a month, about ${Math.round(((s.rent / 2 + 170) / s.gross) * 100)}% of pay before tax. It is the only one that leaves real room to save.` },
            { label: 'The Tower', credit: 0, why: '$1,900 plus $110, $75 and $120 is $2,205 a month, over half your pay before tax. The listed rent was only part of the price.' },
          ],
        }),
      ({ s }) => {
        const need = s.rent / 2 + s.rent / 2 + 50 + 75;
        return dial({
          brief: 'You choose the two-bed. Before you get keys, the landlord wants the first month’s rent, a security deposit equal to one month’s rent, and a $50 application fee from each tenant. The power company wants a $150 deposit, which you and your roommate will split.',
          visual: <Table head={['Due before move-in', 'Your share']} rows={[['First month’s rent', usd(s.rent / 2)], ['Security deposit', usd(s.rent / 2)], ['Application fee', '$50'], ['Half the utility deposit', '$75']]} />,
          prompt: 'How much cash do you need on day one?',
          min: 0,
          max: 5000,
          step: 25,
          answer: need,
          tol: 25,
          fmt: (v) => usd(v),
          why: `${usd(s.rent / 2)} + ${usd(s.rent / 2)} + $50 + $75 = ${usd(need)}, before a bed or a single plate. Most of a first paycheck has not arrived yet, which is why moving out takes savings.`,
        });
      },
      ({ s }) =>
        flag({
          brief: 'The lease arrives by email. It is nine pages; these are the clauses that matter.',
          prompt: 'Flag the clauses that could cost you money you did not expect.',
          doc: {
            title: 'Residential Lease',
            sub: 'Unit 3B · 12 months',
            skin: 'contract',
            lines: [
              { id: 'rent', l: `Rent of ${usd(s.rent)} is due on the 1st of each month.` },
              { id: 'joint', l: 'All tenants are jointly and severally liable for the full rent and all damages.' },
              { id: 'late', l: 'Rent received after the 2nd incurs a late fee of $150.' },
              { id: 'dep', l: 'The security deposit will be returned within 30 days of move-out, less itemized deductions for damage beyond normal wear.' },
              { id: 'renew', l: 'This lease renews automatically for a further 12 months unless written notice is given 60 days before it ends.' },
              { id: 'ins', l: 'Tenants must carry renter’s insurance with $100,000 of liability cover.' },
              { id: 'repair', l: 'Tenants are responsible for all repairs to the unit, including appliances and plumbing.' },
              { id: 'smoke', l: 'No smoking anywhere in the building.' },
            ],
          },
          issues: {
            joint: 'If your roommate stops paying, the landlord can demand the whole rent from you. It is standard, and it is the single biggest risk of sharing.',
            late: 'One day’s grace and a $150 penalty is steep. Many places cap late fees; ask for a five-day grace period.',
            renew: 'Miss the 60-day notice by a week and you owe another full year. Put the date in your calendar the day you sign.',
            repair: 'Landlords normally fix appliances and plumbing. This shifts a broken water heater, which could cost $1,500, onto you.',
          },
          fine: {
            rent: 'This is the rent you agreed to.',
            dep: 'This is how deposits should work: a deadline and itemized deductions.',
            ins: 'Renter’s insurance costs about $15 a month and protects your belongings and your liability. This requirement is doing you a favor.',
            smoke: 'A normal building rule with no cost to you.',
          },
        }),
      ({ s }) =>
        pick({
          brief: 'Month five. Your roommate loses their job.',
          visual: <Feed title="Messages" posts={[{ who: 'Riley', text: 'I am so sorry. I can not cover my half this month, maybe not next month either. Can you spot me?', meta: 'The 29th, 9:12 pm' }]} />,
          prompt: 'Where do you stand with the landlord?',
          options: [
            { label: `You can be made to pay the full ${usd(s.rent)}, so talk to the landlord early and start looking for a replacement roommate`, credit: 1, why: 'Jointly and severally liable means the landlord can collect all of it from either of you. Early contact and a replacement are the only moves that limit the damage; an emergency fund buys the time.' },
            { label: 'You only owe your half. The rest is between Riley and the landlord', credit: 0, why: 'That is how it feels, but not what you signed. The lease makes each tenant liable for the whole rent.' },
            { label: 'Pay your half and let the late fee fall on Riley', credit: 0.1, why: 'Unpaid rent and late fees are owed by both names on the lease, and an eviction filing would land on both records.' },
            { label: 'Move out. A broken lease only costs the deposit', credit: 0, why: 'You would still owe rent until the unit is re-let, could be sued for it, and may carry a collection mark on your credit.' },
          ],
        }),
      () =>
        pick({
          brief: 'A year on, you move out and leave the place clean. The landlord returns your deposit minus $600 for "carpet wear and repainting".',
          prompt: 'What gives you the best chance of getting the $600 back?',
          options: [
            { label: 'Dated photos and a signed checklist from move-in day, and a written request citing normal wear and tear', credit: 1, why: 'Faded paint and worn carpet from ordinary living are normal wear, which landlords generally cannot charge for. Proof of the starting condition wins these disputes, and it takes ten minutes on move-in day.' },
            { label: 'Nothing. Landlords can deduct what they like', credit: 0, why: 'Deductions must be for real damage beyond normal wear, and most places require an itemized list. Tenants who ask in writing often get money back.' },
            { label: 'Leave an angry online review', credit: 0, why: 'It may feel good, but it is not evidence and it does not create any duty to pay you.' },
            { label: 'Skip the last month’s rent next time and call it even', credit: 0.1, why: 'Withholding rent breaks the lease and can lead to fees or an eviction filing. The deposit and the rent are separate.' },
          ],
        }),
      () =>
        pick({
          brief: 'One more thing from that year: a kitchen fire in the unit next door filled your apartment with smoke and ruined your laptop, mattress and clothes.',
          prompt: 'Who pays to replace your things?',
          options: [
            { label: 'Your renter’s insurance. The landlord’s policy covers the building, not what is inside your unit', credit: 1, why: 'This is the gap most first-time renters do not know about. For about $15 a month, renter’s insurance covers your belongings, a hotel while the unit is repaired, and your liability if you cause damage.' },
            { label: 'The landlord’s insurance', credit: 0, why: 'The landlord insures the structure they own. Your belongings were never part of that policy.' },
            { label: 'The neighbor, automatically', credit: 0.2, why: 'You might be able to claim against the neighbor, but it would mean proving fault and waiting. Your own policy pays first and fast.' },
            { label: 'Nobody. Fires are just bad luck', credit: 0.1, why: 'Without insurance that is how it ends, which is exactly what the policy is for.' },
          ],
        }),
    ],
    alts: {
      0: [
        ({ s }) =>
          pick({
            brief: `You start your first full-time job next month at ${usd(s.gross)} a month before tax. A common guideline is to keep housing near 30% of pay before tax.`,
            visual: (
              <Cards
                cards={[
                  { icon: '🏠', title: 'Basement suite', sub: 'On your own', facts: [['Rent', '$1,200'], ['Utilities', 'About $120'], ['Commute', '25 minutes by bike'], ['Extras', 'None']] },
                  { icon: '🏡', title: 'Room in a shared house', sub: 'Two housemates', facts: [['Rent', '$950'], ['Utilities', 'Included'], ['Commute', '20 minutes by bus'], ['Extras', 'Bus pass $80']] },
                  { icon: '🏙️', title: 'New-build one-bed', sub: 'On your own', tag: 'Brand new', facts: [['Rent', '$1,650'], ['Utilities', 'About $100'], ['Commute', '10 minutes'], ['Extras', 'Parking $100']] },
                ]}
              />
            ),
            prompt: 'Which one fits your pay?',
            ordered: true,
            options: [
              { label: 'Basement suite', credit: 0.6, why: '$1,320 all in is about 31% of pay before tax. Workable, with a little less room to save.' },
              { label: 'Room in a shared house', credit: 1, why: '$950 plus an $80 bus pass is $1,030, about 25% of pay before tax. It leaves the most to save.' },
              { label: 'New-build one-bed', credit: 0, why: '$1,650 + $100 + $100 = $1,850, about 44% of pay before tax. Shiny, and very tight.' },
            ],
          }),
      ],
      1: [
        ({ s }) => {
          const need = (s.rent / 2) * 3 + 50;
          return dial({
            brief: 'A different landlord wants first and last month’s rent upfront, plus a broker fee of one month’s rent. You and your roommate split everything, and each pay a $50 application fee.',
            visual: <Table head={['Due before move-in', 'Your share']} rows={[['First month’s rent', usd(s.rent / 2)], ['Last month’s rent', usd(s.rent / 2)], ['Broker fee', usd(s.rent / 2)], ['Application fee', '$50']]} />,
            prompt: 'How much cash do you need on day one?',
            min: 0,
            max: 6000,
            step: 25,
            answer: need,
            tol: 25,
            fmt: (v) => usd(v),
            why: `${usd(s.rent / 2)} × 3 + $50 = ${usd(need)}. Broker fees and last month’s rent make some places far more expensive to move into than their monthly rent suggests.`,
          });
        },
      ],
      2: [
        ({ s }) =>
          flag({
            brief: 'A second lease arrives. These are the clauses that matter.',
            prompt: 'Flag the clauses that are unfair or could cost you money.',
            doc: {
              title: 'Residential Lease',
              sub: 'Unit 2A · 12 months',
              skin: 'contract',
              lines: [
                { id: 'rent', l: `Rent of ${usd(s.rent)} is due on the 1st of each month.` },
                { id: 'entry', l: 'The landlord may enter the unit at any time without notice.' },
                { id: 'fees', l: 'Tenants pay the landlord’s legal fees in any dispute, whoever wins.' },
                { id: 'clean', l: '$400 of the security deposit is a non-refundable cleaning fee.' },
                { id: 'raise', l: 'Rent may be increased at the landlord’s discretion during the lease.' },
                { id: 'pets', l: 'Pets allowed with a $300 refundable pet deposit.' },
                { id: 'trash', l: 'Trash is collected on Mondays.' },
              ],
            },
            issues: {
              entry: 'Most places require reasonable notice, usually 24 hours, except in emergencies.',
              fees: 'A one-sided fees clause discourages you from ever challenging the landlord, even when you are right.',
              clean: 'Calling part of a deposit non-refundable means you lose it however clean you leave the place. Many places do not allow this.',
              raise: 'A 12-month lease should lock the rent for 12 months. This clause takes that away.',
            },
            fine: {
              rent: 'The rent you agreed to.',
              pets: 'A refundable deposit is fair if you have a pet.',
              trash: 'A normal building rule.',
            },
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'Month three. Your roommate’s partner has started staying every night, using the kitchen, hot water and heating, but is not on the lease.',
            prompt: 'What is the best move?',
            options: [
              { label: 'Talk openly: agree a fair share of bills, and check whether the lease needs the landlord’s approval for another occupant', credit: 1, why: 'Many leases limit long-term guests. Clear agreements about money stop resentment, and staying within the lease protects both of you.' },
              { label: 'Say nothing to avoid an argument', credit: 0.1, why: 'You end up paying more of the bills and may be breaking the lease without knowing.' },
              { label: 'Report them to the landlord immediately', credit: 0.3, why: 'It may come to that, but talking first usually solves it and keeps the household working.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'You moved out 45 days ago. The lease says the deposit comes back within 30 days. You have heard nothing.',
            prompt: 'What should you do?',
            options: [
              { label: 'Send a written demand that quotes the lease and the deadline, keep a copy, and be ready to use small claims court', credit: 1, why: 'Many places penalise landlords who miss the deadline, sometimes with double the deposit. A clear written request often gets the money moving.' },
              { label: 'Wait longer and hope it arrives', credit: 0.1, why: 'Waiting gives up your leverage and may run past legal time limits.' },
              { label: 'Post the landlord’s address online', credit: 0, why: 'That helps nobody and could get you into trouble.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'You fall asleep with the bath running. Water leaks into the apartment below and causes $8,000 of damage.',
            prompt: 'Who pays?',
            options: [
              { label: 'You do, but the liability cover in your renter’s insurance pays the claim', credit: 1, why: 'Liability cover pays when you accidentally damage someone else’s property. Without it, the $8,000 bill is yours.' },
              { label: 'The landlord’s insurance covers everything', credit: 0.2, why: 'The landlord’s policy may repair the building, then their insurer can come after you for the cost.' },
              { label: 'The neighbor’s insurance, since it was their apartment', credit: 0.2, why: 'Their insurer may pay them first, then seek the money back from you.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Compare the all-in monthly cost: rent plus utilities, fees, parking and the commute.',
      'Moving in takes roughly two months of rent in cash before you sleep there once.',
      'On a shared lease you are responsible for the whole rent. Choose roommates like business partners.',
      'Photograph everything on move-in day, calendar the notice date, and carry renter’s insurance.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
