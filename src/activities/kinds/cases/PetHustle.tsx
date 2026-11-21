'use client';
/**
 * Pet Sitting Side Hustle (Advanced, Pet Shop). A first small business, one decision at a time:
 * price, real hourly pay, no-shows, growing, liability, taxes and what to do with the profit.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Feed, dial, pick, type CaseDef } from './kit';

interface S {
  price: number;
  travel: number;
}

export default function PetHustle({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Pet Shop · Pet sitting side hustle',
    init: (rng) => ({ price: 18, travel: rng.pick([15, 20, 25]) }),
    meters: (s) => [['Your price per walk', usd(s.price)], ['Market rate', '$20']],
    steps: [
      () =>
        pick({
          brief: 'You are starting a dog-walking business in your neighborhood. Established walkers nearby charge about $20 for a 30-minute walk. You have no reviews yet.',
          prompt: 'What do you charge?',
          options: [
            { label: '$18, with the first walk free for your first three clients', credit: 1, why: 'Just under the market rate gets you chosen while you have no reviews, and a free trial costs little. You can reach $20 once you have a reputation.', apply: (s) => void (s.price = 18) },
            { label: '$8, to undercut everyone', credit: 0.2, why: 'You will fill up fast, earn little, and train clients to expect $8. Doubling a price later loses most of them.', apply: (s) => void (s.price = 8) },
            { label: '$30, because premium prices signal quality', credit: 0.2, why: 'Premium pricing needs proof: reviews, insurance, experience. With none, clients pick the known walker at $20.', apply: (s) => void (s.price = 30) },
            { label: '$20, the same as the pros', credit: 0.6, why: 'Fair, but at the same price a client has no reason to choose the walker with no reviews.', apply: (s) => void (s.price = 20) },
          ],
        }),
      ({ s }) => {
        const mins = 30 + s.travel;
        const hourly = ((s.price - 1) / mins) * 60;
        return dial({
          brief: `Each walk is 30 minutes with the dog, plus ${s.travel} minutes getting there and back. Bags and treats cost you about $1 a walk. You charge ${usd(s.price)}.`,
          visual: <Table head={['Per walk', '']} rows={[['Price', usd(s.price)], ['Supplies', '−$1'], ['Time, door to door', `${mins} minutes`]]} />,
          prompt: 'What do you really earn per hour?',
          min: 4,
          max: 50,
          step: 0.5,
          answer: Math.round(hourly * 2) / 2,
          tol: 1,
          fmt: (v) => `${usd(v, 2)} / hour`,
          why: `You keep ${usd(s.price - 1)} for ${mins} minutes of your time: ${usd(s.price - 1)} ÷ ${mins} × 60 = ${usd(hourly, 2)} an hour. Travel is unpaid work, so clients close together are worth more than a higher price far away.`,
        });
      },
      () =>
        pick({
          brief: 'Six weeks in you have eight regular clients. One has cancelled three times, each time as you were arriving.',
          visual: <Feed title="Messages" posts={[{ who: 'Mrs. Albright', text: 'So sorry!! Change of plans, Biscuit is going to the lake with us. Skip today?', meta: '3:58 pm, for a 4:00 pm walk' }]} />,
          prompt: 'How do you handle it?',
          options: [
            { label: 'Send every client a simple policy: cancel 24 hours ahead, or pay half', credit: 1, why: 'A policy that applies to everyone is not personal, pays you for a slot you could not resell, and good clients accept it without complaint.' },
            { label: 'Say nothing. She is a regular and you do not want to lose her', credit: 0.1, why: 'Each cancellation costs you the fee and the travel time, and silence teaches her it is free to do again.' },
            { label: 'Drop her as a client', credit: 0.4, why: 'It stops the losses but gives up regular income. A cancellation fee usually fixes the behavior and keeps the client.' },
            { label: 'Quietly raise her price to make up for it', credit: 0.2, why: 'A surprise price rise for one client feels unfair and does nothing about the next cancellation.' },
          ],
        }),
      ({ s }) =>
        pick({
          brief: `You are full at 15 walks a week around school, with six families on a waiting list. A friend offers to take walks for $10 each.`,
          prompt: 'How do you grow?',
          options: [
            { label: `Raise the price to ${usd(s.price + 4)} for new clients first, then decide about hiring`, credit: 1, why: 'A waiting list means your price is too low. Raising it earns more from the same hours with no extra risk, and it shows you what the market will pay.', apply: (st) => void (st.price += 4) },
            s.price > 10
              ? { label: `Hire your friend at $10 and keep the other ${usd(s.price - 10)} per walk`, credit: 0.7, why: 'That margin is real money for scheduling and finding clients. But you now answer for someone else’s reliability, and one bad walk costs your reputation, not theirs.' }
              : { label: `Hire your friend at $10, more than the ${usd(s.price)} you charge`, credit: 0, why: 'You would lose money on every walk your friend takes. A price below what help costs is a business that cannot grow.' },
            { label: 'Take all six families yourself', credit: 0, why: 'Twenty-one walks a week on top of school is how grades and service both slip. Your time is the limit of this business.' },
            { label: 'Turn the six families away', credit: 0.3, why: 'It protects your time, but it ignores what the waiting list is telling you: people would pay more.' },
          ],
        }),
      () =>
        pick({
          brief: 'On a walk, a leash clip snaps and Biscuit bolts into the road. He is fine after a $400 vet visit. You had no written agreement with the owner.',
          prompt: 'What should have been in place before your first walk?',
          options: [
            { label: 'A one-page service agreement and pet-sitter insurance, about $15 a month', credit: 1, why: 'The agreement says who pays for what, and the insurance pays when something goes wrong. $180 a year protects you from a bill that could wipe out the whole year’s profit.' },
            { label: 'Nothing. Accidents are the owner’s problem', credit: 0, why: 'While the dog is in your care you can be held responsible. With no agreement, it is your word against theirs.' },
            { label: 'A higher price to cover accidents', credit: 0.3, why: 'Saving for accidents helps, but one serious injury can cost thousands. Insurance exists because rare, large costs are hard to save for.' },
            { label: 'A rule to only walk small dogs', credit: 0.1, why: 'Small dogs slip leashes too. Reducing risk is good; having no plan for when it happens is the gap.' },
          ],
        }),
      () =>
        pick({
          brief: 'By December you have taken in $3,200, mostly through a payment app and some cash, and spent $350 on supplies and insurance.',
          visual: <Table head={['Your year', '']} rows={[['Income', '$3,200'], ['Expenses', '−$350'], ['Net earnings', '$2,850']]} hl={[2]} />,
          prompt: 'Do you owe any tax on it?',
          options: [
            { label: 'Yes. Net self-employment earnings over $400 must be reported, with about 15.3% self-employment tax', credit: 1, why: 'The $400 rule surprises many first-time earners. On $2,850 the self-employment tax is roughly $400. Keeping receipts matters: the $350 of expenses lowered the bill.' },
            { label: 'No. Cash and app payments from neighbors are not taxable', credit: 0, why: 'Income is taxable however it is paid. Cash is simply harder for anyone to see, which is not the same as exempt.' },
            { label: 'Only if a tax form arrives in the post', credit: 0.2, why: 'A form from a payment app is a report to the tax office, not what creates the duty. You owe on the income whether or not a form shows up.' },
            { label: 'No. Students under 18 do not pay tax', credit: 0, why: 'There is no age limit on tax. A 16-year-old with self-employment income files like anyone else.' },
          ],
        }),
      () =>
        pick({
          brief: 'After tax you have about $2,000 of profit, and you do not need it for bills.',
          prompt: 'What is the strongest use of it?',
          options: [
            { label: 'Put most of it in a Roth IRA, which you can open because you have earned income', credit: 1, why: 'Earned income is the ticket to a Roth IRA at any age. $2,000 invested at 16 and left alone at 7% a year is about $55,000 at 65, and it comes out tax-free.' },
            { label: 'Leave it in the payment app balance', credit: 0, why: 'App balances usually earn nothing and often are not covered by deposit insurance. It is the least useful place for money to sit.' },
            { label: 'Spend it on branded jackets and a website', credit: 0.3, why: 'Reinvesting can be right, but you already have a waiting list. Spending to find clients you cannot serve earns nothing.' },
            { label: 'Keep it all in savings for emergencies', credit: 0.6, why: 'A cushion is sensible, and some of it should stay there. But money a 16-year-old will not need for decades can do far more invested.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'You walk dogs for $18 while pros nearby charge $20. A neighbor offers a deal: five walks a week, every week, if you drop to $15.',
            prompt: 'What do you do?',
            options: [
              { label: 'Counter at $17 for the guaranteed five walks a week', credit: 1, why: 'Guaranteed work is worth a small discount: no gaps, no searching. Countering keeps most of your price.', apply: (s) => void (s.price = 17) },
              { label: 'Accept $15: a sure thing is a sure thing', credit: 0.6, why: 'Steady work has value, but you gave away more than you needed to without asking.', apply: (s) => void (s.price = 15) },
              { label: 'Refuse and keep $18 for everyone', credit: 0.5, why: 'Consistent prices are fine, but you turned down a reliable client who would fill your week.', apply: (s) => void (s.price = 18) },
              { label: 'Ask for $25 since they want so many walks', credit: 0.1, why: 'Volume usually earns a discount, not a premium. They will go to a pro at $20.', apply: (s) => void (s.price = 25) },
            ],
          }),
      ],
      1: [
        ({ s }) => {
          const mins = 30 + s.travel;
          const hourly = ((2 * (s.price - 1)) / mins) * 60;
          return dial({
            brief: `Two dogs on the same street now walk together. Each owner pays ${usd(s.price)}, supplies cost $1 per dog, and the walk takes 30 minutes plus ${s.travel} minutes of travel.`,
            visual: <Table head={['Per group walk', '']} rows={[['Two dogs × price', usd(2 * s.price)], ['Supplies', '−$2'], ['Time, door to door', `${mins} minutes`]]} />,
            prompt: 'What do you earn per hour on a group walk?',
            min: 4,
            max: 80,
            step: 0.5,
            answer: Math.round(hourly * 2) / 2,
            tol: 1,
            fmt: (v) => `${usd(v, 2)} / hour`,
            why: `You keep ${usd(2 * (s.price - 1))} for ${mins} minutes: ${usd(2 * (s.price - 1))} ÷ ${mins} × 60 = ${usd(hourly, 2)} an hour. Serving two clients in the same time nearly doubles your pay, if both dogs get along.`,
          });
        },
      ],
      2: [
        () =>
          pick({
            brief: 'One family owes you $90 for five walks. It has been three weeks, and they keep saying “next week”.',
            prompt: 'How do you handle it?',
            options: [
              { label: 'Send a friendly written invoice, and ask all clients to pay weekly in advance from now on', credit: 1, why: 'A clear invoice is polite and hard to ignore. Paying ahead removes the problem for every future walk.' },
              { label: 'Keep walking and hope they pay', credit: 0.1, why: 'The debt grows each week. Unpaid work is the fastest way a small business fails.' },
              { label: 'Post about them online', credit: 0, why: 'Public shaming can damage your reputation more than theirs.' },
              { label: 'Stop walking their dog until they pay', credit: 0.6, why: 'Fair and firm, but an invoice and a clear policy usually fix it without losing the client.' },
            ],
          }),
      ],
      3: [
        ({ s }) =>
          pick({
            brief: `You are full at 15 walks a week. The pet shop offers to send you customers if you give them $3 of every walk from a referral. You charge ${usd(s.price)}.`,
            prompt: 'What is the smartest response?',
            options: [
              { label: 'Offer a one-time $10 thank-you for each new regular client instead', credit: 1, why: 'A flat fee per new client costs far less than $3 on every walk forever. A regular client walks 100+ times a year.' },
              { label: 'Accept: more clients is always good', credit: 0.3, why: `You are already full. Giving $3 of ${usd(s.price)} forever only makes sense if you need clients, and you do not.` },
              { label: 'Raise your price for new clients before taking on more', credit: 0.8, why: 'Being full means you can charge more. Do that first, then decide whether referrals are worth paying for.', apply: (st) => void (st.price += 4) },
              { label: 'Refuse without discussing it', credit: 0.4, why: 'You avoid a bad deal, but miss a chance to agree a better one.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'A client going away for a week asks you to give their dog a pill twice a day as well as walking him.',
            prompt: 'What should you do before saying yes?',
            options: [
              { label: 'Get written instructions and the vet’s number, agree a price for the extra visits, and check your insurance covers it', credit: 1, why: 'Medication adds responsibility. Clear instructions protect the dog and you, and the extra time deserves extra pay.' },
              { label: 'Say yes and figure it out on the day', credit: 0.1, why: 'A missed or wrong dose can make a pet very ill, and you would be responsible.' },
              { label: 'Refuse: medicine is too risky', credit: 0.4, why: 'Careful, but with the right instructions it is a normal, well-paid extra service.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'Your payment app sends a tax form showing $3,400 received. But $200 was a friend paying you back for concert tickets, not dog-walking.',
            prompt: 'What do you report?',
            options: [
              { label: 'Only the $3,200 of business income, and keep a record showing the $200 was a repayment', credit: 1, why: 'Repayments between friends are not income. Keeping notes makes it easy to explain the difference if anyone asks.' },
              { label: 'The full $3,400, because that is what the form says', credit: 0.4, why: 'You would pay tax on money that was never income. Report what you actually earned.' },
              { label: 'Nothing, since the form is wrong', credit: 0, why: 'The form is only partly wrong. The $3,200 is real income and must be reported.' },
            ],
          }),
      ],
      6: [
        () =>
          pick({
            brief: 'You have about $2,000 of profit. You need a $1,200 used laptop for school in three months.',
            prompt: 'What is the strongest plan?',
            options: [
              { label: 'Keep $1,200 in a high-yield savings account for the laptop, and put the rest in a Roth IRA', credit: 1, why: 'Money needed in months belongs somewhere safe. Money you will not touch for decades can be invested.' },
              { label: 'Invest all $2,000 in stocks and sell in three months', credit: 0.3, why: 'Stocks can fall 20% in three months. Short-term money should not take that risk.' },
              { label: 'Buy the laptop on a credit card now and pay it off later', credit: 0.2, why: 'You have the cash. Borrowing just adds interest risk.' },
              { label: 'Leave it all in the payment app', credit: 0, why: 'App balances usually earn nothing and may not be insured.' },
            ],
          }),
      ],
    },
    outcome: (s) => ({ headline: s.price >= 20 ? `A real business, at ${usd(s.price)} a walk` : `Year one done, at ${usd(s.price)} a walk`, bonus: s.price >= 20 ? 3 : 0 }),
    takeaways: [
      'Price from what the market pays, then use demand as your signal: a waiting list means charge more.',
      'Count all your time. Travel and admin are unpaid unless your price covers them.',
      'Policies and a written agreement protect the friendship and the business.',
      'Self-employment income over $400 is taxable, and earned income lets you start a Roth IRA.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
