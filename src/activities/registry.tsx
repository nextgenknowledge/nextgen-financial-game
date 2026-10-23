'use client';
/** Maps an activity `kind` (from data) to its component. Bespoke games are code-split. */
import { lazy, type ComponentType } from 'react';
import type { KindProps } from './types';
import { Quiz, QuizTower } from './kinds/Quiz';

type K = ComponentType<KindProps<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
const L = (f: () => Promise<{ default: K }>) => lazy(f) as unknown as K;

export const KINDS: Record<string, K> = {
  quiz: Quiz,
  tower: QuizTower,
  sort: L(() => import('./kinds/Sort')),
  memory: L(() => import('./kinds/Memory')),
  allocate: L(() => import('./kinds/Allocate')),
  story: L(() => import('./kinds/Story')),
  teller: L(() => import('./kinds/Teller')),
  creditSim: L(() => import('./kinds/CreditSim')),
  coinCatcher: L(() => import('./kinds/CoinCatcher')),
  priceDash: L(() => import('./kinds/PriceDash')),
  carDeal: L(() => import('./kinds/CarDeal')),
  job: L(() => import('./kinds/Job')),
  negotiation: L(() => import('./kinds/Negotiation')),
  options: L(() => import('./kinds/Options')),
  coding: L(() => import('./kinds/Coding')),
  phishing: L(() => import('./kinds/Phishing')),
  password: L(() => import('./kinds/Password')),
  taxReturn: L(() => import('./kinds/TaxReturn')),
  paycheckDecoder: L(() => import('./kinds/PaycheckDecoder')),
  candles: L(() => import('./kinds/Candles')),
  portfolio10y: L(() => import('./kinds/Portfolio10y')),
  dca: L(() => import('./kinds/Dca')),
  newsroom: L(() => import('./kinds/Newsroom')),
  startups: L(() => import('./kinds/Startups')),
  grocery: L(() => import('./kinds/Grocery')),
  deals: L(() => import('./kinds/Deals')),
  changeCounter: L(() => import('./kinds/ChangeCounter')),
  fx: L(() => import('./kinds/Fx')),
  rentBuy: L(() => import('./kinds/RentBuy')),
  budgetPlanner: L(() => import('./kinds/BudgetPlanner')),
  nightMarket: L(() => import('./kinds/NightMarket')),
  trading: L(() => import('./kinds/Trading')),
  accounting: L(() => import('./kinds/Accounting')),
  breakEven: L(() => import('./kinds/BreakEven')),
  delivery: L(() => import('./kinds/Delivery')),
  garden: L(() => import('./kinds/Garden')),
  retirementSim: L(() => import('./kinds/RetirementSim')),
  insuranceSim: L(() => import('./kinds/InsuranceSim')),
  emergencySim: L(() => import('./kinds/EmergencySim')),
  loanCompare: L(() => import('./kinds/LoanCompare')),
};
