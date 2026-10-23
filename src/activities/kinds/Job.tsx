'use client';
import { useState } from 'react';
import type { KindProps } from '../types';
import { useGame, act } from '@/store/game';
import { JOBS, jobTitle, shiftGross, workShift, type JobDef, type ShiftResult } from '@/game/finance/jobs';
import { SKILLS } from '../skills';
import { Button, ReadAloud } from '@/ui/common';
import { money } from '@/ui/format';
import { starsFor } from '@/game/progress/activities';

/** Pick a job, play its skill game, get a pay stub. Wages are the reward (no extra cash). */
export default function Job({ def, params, difficulty, onFinish, seed }: KindProps<{ board: string }>) {
  const w = useGame((s) => s.world!);
  const entry = difficulty === 'entry';
  const [job, setJob] = useState<JobDef | null>(null);
  const [stub, setStub] = useState<null | { score: number; res: ShiftResult }>(null);
  const jobs = JOBS.filter((j) => j.board === params.board);

  if (stub && job) {
    const s = stub.res.stub;
    return (
      <div className="col" style={{ gap: 10 }}>
        <h3 style={{ margin: 0 }}>
          {job.icon} Shift complete, {stub.res.title}
        </h3>
        <div className="paystub">
          <div className="row between bold">
            <span>FIN CITY PAY STUB</span>
            <span>{job.name}</span>
          </div>
          <div className="row between">
            <span>Gross pay</span>
            <b>{money(s.gross)}</b>
          </div>
          {!entry && (
            <>
              <div className="row between">
                <span>Federal income tax (withheld)</span>
                <span>−{money(s.federal)}</span>
              </div>
              <div className="row between">
                <span>Social Security (6.2%)</span>
                <span>−{money(s.socialSecurity)}</span>
              </div>
              <div className="row between">
                <span>Medicare (1.45%)</span>
                <span>−{money(s.medicare)}</span>
              </div>
              <div className="row between">
                <span>City tax (3%)</span>
                <span>−{money(s.city)}</span>
              </div>
            </>
          )}
          {s.retirement > 0 && (
            <div className="row between">
              <span>Retirement contribution{w.finance.retirement.roth ? ' (Roth)' : ' (pre-tax)'}</span>
              <span>−{money(s.retirement)}</span>
            </div>
          )}
          <div className="row between bold" style={{ borderTop: '2px dashed #999', paddingTop: 4 }}>
            <span>NET PAY (deposited)</span>
            <span className="good">{money(s.net)}</span>
          </div>
          {stub.res.match > 0 && (
            <div className="row between small good">
              <span>Employer retirement match (free money!)</span>
              <span>+{money(stub.res.match)}</span>
            </div>
          )}
        </div>
        <p className="small">
          {entry
            ? `Great work! ${money(s.net)} went into your ${w.finance.hasChecking ? 'checking account' : 'pocket as cash'}.`
            : `Gross ${money(s.gross)} → net ${money(s.net)}: ${((1 - s.net / s.gross) * 100).toFixed(1)}% went to taxes and deductions. Budget with net pay!`}
          {stub.res.promoted && <b className="good"> You were promoted to {stub.res.promoted}!</b>}
          <ReadAloud text={`You earned ${money(s.gross)} and took home ${money(s.net)}.`} />
        </p>
        <Button variant="primary" size="big" onClick={() => onFinish({ score: stub.score, noCash: true, earned: s.net, summary: `${job.name}: ${money(s.net)} net pay.` })}>
          Finish shift
        </Button>
      </div>
    );
  }

  if (job) {
    const Skill = SKILLS[job.skill];
    const tier = w.progress.jobs[job.id]?.level ?? 1;
    return (
      <div className="col" style={{ gap: 8 }}>
        <div className="card tint-teal small">
          {job.icon} <b>{job.name}</b>, {job.blurb}
        </div>
        <Skill
          entry={entry}
          tier={tier}
          seed={seed}
          onDone={(score) => {
            let res: ShiftResult | null = null;
            const stars = starsFor(def, score);
            act((d, fx) => {
              res = workShift(d, fx, job.id, score, stars);
            });
            if (res) setStub({ score, res });
          }}
        />
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <p className="small">
        {entry ? 'Pick a job! Do your best, better work means better pay.' : 'Choose a job. Pay depends on performance and your title. Good shifts lead to promotions (+15% pay each).'}
      </p>
      <div className="item-grid">
        {jobs.map((j) => {
          const st = w.progress.jobs[j.id];
          const locked = j.level && w.progress.level < j.level;
          return (
            <div key={j.id} className="item-card">
              <span style={{ fontSize: '2.2rem' }}>{j.icon}</span>
              <b>{j.name}</b>
              <span className="tiny muted">{j.blurb}</span>
              <span className="small">
                {jobTitle(w, j)} · up to <b>{money(shiftGross(w, j, 100))}</b>/shift
              </span>
              {st && <span className="tiny">{st.shifts} shifts worked</span>}
              {j.match && !entry && <span className="tiny chip good">Retirement match</span>}
              <Button size="small" variant="primary" disabled={!!locked} onClick={() => setJob(j)}>
                {locked ? `🔒 Level ${j.level}` : 'Work a shift'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
