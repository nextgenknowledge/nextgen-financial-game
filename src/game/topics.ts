import type { Topic } from './types';

export const TOPIC_INFO: Record<Topic, { name: string; icon: string; blurb: string }> = {
  counting: { name: 'Counting Money', icon: '🪙', blurb: 'Coins, bills and making change' },
  'needs-wants': { name: 'Needs & Wants', icon: '⚖️', blurb: 'Telling must-haves from nice-to-haves' },
  saving: { name: 'Saving', icon: '🐷', blurb: 'Goals, emergency funds and patience' },
  earning: { name: 'Earning', icon: '💼', blurb: 'Jobs, careers and paychecks' },
  budgeting: { name: 'Budgeting', icon: '📋', blurb: 'Planning where your money goes' },
  shopping: { name: 'Smart Shopping', icon: '🛒', blurb: 'Prices, deals and unit prices' },
  banking: { name: 'Banking', icon: '🏦', blurb: 'Accounts, deposits and what banks do' },
  interest: { name: 'Interest', icon: '📈', blurb: 'Simple and compound interest, APR & APY' },
  investing: { name: 'Investing', icon: '💹', blurb: 'Stocks, bonds, funds and risk' },
  business: { name: 'Business', icon: '🏢', blurb: 'Revenue, costs and profit' },
  safety: { name: 'Money Safety', icon: '🛡️', blurb: 'Scams, phishing and identity theft' },
  credit: { name: 'Credit', icon: '💳', blurb: 'Credit cards and credit scores' },
  debt: { name: 'Borrowing', icon: '📝', blurb: 'Loans, payments and the cost of debt' },
  taxes: { name: 'Taxes', icon: '🧾', blurb: 'Paychecks, brackets and filing' },
  retirement: { name: 'Retirement', icon: '🏖️', blurb: 'Long-term saving and time value of money' },
  insurance: { name: 'Insurance', icon: '☂️', blurb: 'Premiums, deductibles and protection' },
  economics: { name: 'Economics', icon: '🌍', blurb: 'Supply, demand, inflation and trade' },
  giving: { name: 'Giving', icon: '💝', blurb: 'Charity and community' },
  housing: { name: 'Housing', icon: '🏡', blurb: 'Renting, buying and mortgages' },
};
