'use client';
/**
 * Vote On It (Advanced, Town Hall). Five measures on Fin City's ballot. Each one sounds simple on
 * the flyer; the task is to see who really pays and what is being traded away.
 */
import type { KindProps } from '../../types';
import { Bars, C, Table, usd, usdK } from '../pro/kit';
import { CaseRunner, Doc, Say, dial, pick, type CaseDef } from './kit';

const ballot = (letter: string, title: string, text: string) => (
  <Doc doc={{ title: `Measure ${letter}`, sub: 'Official ballot text', skin: 'contract', lines: [{ id: 't', l: <b>{title}</b>, head: true }, { id: 'b', l: text, head: true }] }} />
);

export default function VoteOnIt({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<{ bond: number; total: number }> = {
    kicker: 'Town Hall · Vote on it',
    init: (rng) => {
      const bond = rng.pick([30, 40, 50]) * 1e6;
      return { bond, total: Math.round((bond * 1.55) / 1e6) * 1e6 };
    },
    steps: [
      () =>
        pick({
          brief: 'Measure A would add one cent of sales tax on every dollar to pay for more buses.',
          visual: (
            <>
              {ballot('A', 'Better Buses Sales Tax', 'Shall Fin City raise its sales tax by 1% to fund bus service?')}
              <Table head={['Household', 'Income', 'Spends on taxed goods', 'Extra tax a year']} rows={[['The Parks', '$30,000', '$18,000', '$180'], ['The Okafors', '$90,000', '$36,000', '$360'], ['The Vances', '$400,000', '$80,000', '$800']]} />
            </>
          ),
          prompt: 'Who gives up the biggest share of their income?',
          options: [
            { label: 'The Parks: $180 is 0.6% of their income', credit: 1, why: 'The Vances pay the most dollars but only 0.2% of income. Lower earners spend most of what they make, so a sales tax takes a bigger share from them. That is what "regressive" means.' },
            { label: 'The Vances: they pay $800, the most', credit: 0.2, why: 'They pay the most dollars, but $800 of $400,000 is 0.2%. The question is the share of income, where the Parks pay three times as much.' },
            { label: 'Everyone equally: it is the same 1% for all', credit: 0, why: 'The rate on purchases is equal, but people do not spend equal shares of their income. Compare $180 of $30,000 with $800 of $400,000.' },
            { label: 'The Okafors: the middle class always pays most', credit: 0, why: '$360 of $90,000 is 0.4%, in between. The share falls as income rises.' },
          ],
        }),
      ({ s }) =>
        dial({
          brief: `Measure B borrows ${usdK(s.bond)} by selling bonds to build a new high school, repaid from property tax over 25 years. The voter guide says the total cost to taxpayers is ${usdK(s.total)}.`,
          visual: <Bars items={[{ label: 'School cost', value: s.bond, color: C.blue }, { label: 'Total repaid', value: s.total, color: C.gold }]} fmt={(v) => usdK(v)} />,
          prompt: 'How much of the total is interest paid to the bond buyers?',
          min: 0,
          max: s.bond,
          step: 5e5,
          answer: s.total - s.bond,
          tol: 5e5,
          fmt: (v) => usdK(v),
          why: `${usdK(s.total)} − ${usdK(s.bond)} = ${usdK(s.total - s.bond)}. A bond is a loan from investors to the city. Borrowing lets today’s students use the school now, and spreads the cost over the people who benefit for 25 years.`,
        }),
      () =>
        pick({
          brief: 'A neighbor is voting yes on the school bond.',
          visual: <Say who="Neighbor">I rent, so I do not pay property tax. This one is free for me.</Say>,
          prompt: 'Is the neighbor right?',
          options: [
            { label: 'No. Landlords pay the tax and build it into rents over time', credit: 1, why: 'Property tax is a cost of owning the building, like repairs. Studies find a large part of it reaches tenants as higher rent, more so where housing is scarce.' },
            { label: 'Yes. Only owners get a property tax bill', credit: 0, why: 'Only owners get the bill, but who receives a bill and who ends up paying it are different questions. Economists call this tax incidence.' },
            { label: 'No. Renters are billed for bonds separately', credit: 0, why: 'There is no separate renter bill. The cost reaches renters indirectly through rent.' },
            { label: 'Yes, unless the lease says otherwise', credit: 0.2, why: 'It does not need to be in the lease. The landlord simply sets a higher rent at the next renewal.' },
          ],
        }),
      () =>
        pick({
          brief: 'Measure C would cap rent increases at 2% a year on existing apartments.',
          visual: ballot('C', 'Rent Stability Act', 'Shall rent increases on existing apartments be limited to 2% a year?'),
          prompt: 'What is the honest trade-off?',
          options: [
            { label: 'Current tenants get stable rent, but fewer new rentals get built and some owners spend less on upkeep', credit: 1, why: 'This is the pattern most studies find. The people in the apartments now are protected, and the cost falls on future renters looking for a place.' },
            { label: 'There is none: it lowers rent for everyone with no downside', credit: 0, why: 'It helps those already housed. With less reason to build or rent out units, supply shrinks and newcomers face higher prices and longer searches.' },
            { label: 'It only helps landlords', credit: 0, why: 'Landlords earn less on capped units. The winners are the existing tenants.' },
            { label: 'Rents rise faster for capped tenants', credit: 0, why: 'Capped tenants pay less than they otherwise would. The pressure shows up on uncapped and new units.' },
          ],
        }),
      () =>
        pick({
          brief: 'Measure D gives the Fin City Narwhals $200 million toward a new stadium. The team’s flyer promises 3,000 jobs and "a booming downtown".',
          visual: ballot('D', 'Stadium Partnership', 'Shall the city contribute $200,000,000 of public funds toward a privately owned stadium?'),
          prompt: 'Which question matters most before voting?',
          options: [
            { label: 'What else could $200 million do, and what do studies not paid for by the team say?', credit: 1, why: 'This is opportunity cost. Independent economists consistently find stadium subsidies return far less than they cost: fans mostly move spending from other local places.' },
            { label: 'How many seats will it have?', credit: 0, why: 'Capacity affects ticket revenue for the owner. It does not tell voters what the public gets for its $200 million.' },
            { label: 'Will the team win more games?', credit: 0, why: 'Fun to ask, but a city budget is not a fan club. The question is whether this is the best use of public money.' },
            { label: 'Are the 3,000 jobs full-time and year-round?', credit: 0.6, why: 'A sharp question: most stadium jobs are part-time on game days. It still leaves out the bigger issue of what the money could do elsewhere.' },
          ],
        }),
      () =>
        pick({
          brief: 'Measure E cuts the city’s business tax, costing $10 million a year. By law, the city budget must balance.',
          visual: <Bars items={[{ label: 'Police and fire', value: 62, color: C.blue }, { label: 'Roads and transit', value: 34, color: C.blue }, { label: 'Parks and libraries', value: 18, color: C.blue }, { label: 'Debt payments', value: 16, color: C.grey }]} fmt={(v) => `${usd(v)}M`} />,
          prompt: 'What must be true if it passes?',
          options: [
            { label: 'Something has to give: services are cut, another tax or fee rises, or the cut brings in enough new business to cover itself', credit: 1, why: 'A balanced budget is an equation. The flyer names the benefit; the voter’s job is to ask which side of the equation pays for it. Cuts paying for themselves is possible, but rare.' },
            { label: 'Nothing changes: the city just collects less', credit: 0, why: 'The budget has to balance by law, so $10 million less coming in means $10 million less going out, or more coming in from somewhere else.' },
            { label: 'The city prints the difference', credit: 0, why: 'Cities cannot create money. Only a national central bank can.' },
            { label: 'Debt payments are skipped that year', credit: 0, why: 'Skipping bond payments is default. It would wreck the city’s credit rating and make every future project cost more.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'The library needs $6 million more a year. Three ways to raise it are being debated before the city writes Measure A.',
            visual: <Table head={['Way to raise it', 'The Parks ($30,000)', 'The Okafors ($90,000)', 'The Vances ($400,000)']} rows={[['Flat fee per household', '$150', '$150', '$150'], ['Sales tax on entertainment', '$60', '$110', '$300'], ['1% income tax above $40,000', '$0', '$500', '$3,600']]} />,
            prompt: 'Which one is progressive, taking a bigger share of income from higher earners?',
            options: [
              { label: 'The income tax above $40,000', credit: 1, why: 'The Parks pay 0%, the Okafors about 0.6% and the Vances 0.9% of income. The share rises with income.' },
              { label: 'The flat fee: everyone pays the same', credit: 0, why: '$150 is 0.5% of the Parks’ income but only 0.04% of the Vances’. Equal dollars is regressive.' },
              { label: 'The sales tax', credit: 0.1, why: 'Richer households pay more dollars, but $60 of $30,000 is a bigger share than $300 of $400,000.' },
            ],
          }),
      ],
      1: [
        ({ s }) =>
          dial({
            brief: `Measure B borrows ${usdK(s.bond)} to build a new high school, repaid over 25 years. Total repayments come to ${usdK(s.total)}.`,
            visual: <Bars items={[{ label: 'School cost', value: s.bond, color: C.blue }, { label: 'Total repaid', value: s.total, color: C.gold }]} fmt={(v) => usdK(v)} />,
            prompt: 'Interest adds what percentage on top of the cost of the school?',
            min: 0,
            max: 100,
            step: 1,
            answer: Math.round(((s.total - s.bond) / s.bond) * 100),
            tol: 3,
            fmt: (v) => `${v}%`,
            why: `(${usdK(s.total)} − ${usdK(s.bond)}) ÷ ${usdK(s.bond)} = ${Math.round(((s.total - s.bond) / s.bond) * 100)}%. Spread over 25 years, that is the price of having the school now rather than after decades of saving.`,
          }),
      ],
      2: [
        () =>
          pick({
            brief: 'Another neighbor plans to vote no on the school bond.',
            visual: <Say who="Neighbor">I do not have kids. Schools are not my problem.</Say>,
            prompt: 'What is missing from that reasoning?',
            options: [
              { label: 'Everyone pays through property tax or rent, and good schools tend to raise home values and the local economy', credit: 1, why: 'Schools are a shared investment. Today’s students become tomorrow’s workers, business owners and taxpayers, and nearby homes are worth more.' },
              { label: 'Nothing: people without kids get no benefit at all', credit: 0.1, why: 'There are no direct school bills, but the benefits of an educated community reach everyone.' },
              { label: 'The state pays for schools, so the vote does not matter', credit: 0, why: 'This bond is local. Fin City residents repay it.' },
            ],
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'Measure C would raise the minimum wage for city businesses from $16 to $20 an hour.',
            visual: ballot('C', 'Fair Pay Act', 'Shall the minimum wage within city limits rise to $20 an hour?'),
            prompt: 'What is the honest trade-off?',
            options: [
              { label: 'Workers who keep their jobs earn more, while some businesses raise prices or cut hours and hiring', credit: 1, why: 'Studies of moderate increases find real pay gains with small job losses. Bigger jumps carry more risk, especially for small businesses and young workers.' },
              { label: 'There is no downside: businesses can just pay it', credit: 0.1, why: 'Many can, but some respond with higher prices, fewer hours or more automation.' },
              { label: 'It will cause mass unemployment', credit: 0.1, why: 'Research does not support that for moderate increases. The effects are usually modest either way.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'Measure D would make downtown parking free, costing the city $8 million a year in lost parking fees. The flyer says it will bring more shoppers.',
            visual: ballot('D', 'Free Parking Downtown', 'Shall the city end all parking charges downtown?'),
            prompt: 'Which question matters most before voting?',
            options: [
              { label: 'Who pays the $8 million, and what else could it fund? People who walk, bike or take the bus pay too', credit: 1, why: 'Free parking is not free: everyone pays through the budget. Full streets can also mean drivers circling for spaces, which hurts shops.' },
              { label: 'How many parking spaces are downtown?', credit: 0.2, why: 'Useful detail, but it does not answer who pays or what is given up.' },
              { label: 'Will it make parking easier for me?', credit: 0.2, why: 'A fair personal question, but a ballot measure is about the whole city’s money.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'Measure E raises the hotel tax from 10% to 14%. The flyer says: “Visitors pay, not you.”',
            visual: ballot('E', 'Visitor Tax', 'Shall the hotel room tax rise from 10% to 14%?'),
            prompt: 'Is the flyer right?',
            options: [
              { label: 'Mostly, but hotels may lose some bookings to the next town, which can affect local jobs', credit: 1, why: 'Visitors pay most of a hotel tax. If prices rise too far, some stay elsewhere, and hotel owners and workers share the cost.' },
              { label: 'Completely: residents can never be affected', credit: 0.3, why: 'Residents rarely pay it directly, but fewer visitors can mean fewer shifts and less business downtown.' },
              { label: 'No: residents pay all of it through higher rents', credit: 0, why: 'Hotel taxes are mostly paid by travellers, not tenants.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Ask who pays as a share of income, not just in dollars.',
      'The person who gets the bill is not always the person who bears the cost.',
      'Every "yes" spends money that could have done something else. Name the something else.',
      'Read the ballot text and a source with nothing to gain, not just the flyer.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
