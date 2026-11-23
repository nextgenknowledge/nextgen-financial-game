'use client';
/**
 * Admin: for the Fin City team only. Asks for the team's code, then gives full control: infinite
 * money, any level, every city and outfit, finish quests, fly (double-tap Space), speed, jump to
 * any city or building, and play any activity straight away. Using it marks the world as an admin
 * world, which keeps it off the leaderboard.
 */
import { useEffect, useMemo, useState } from 'react';
import { useGame, act } from '@/store/game';
import { useUI } from '@/store/ui';
import { useScene } from '@/store/scene';
import { rt } from '@/engine/runtime';
import { playSfx } from '@/engine/audio';
import { Section } from '../../kit';
import { Button } from '../../common';
import { useAdmin, loadAdmin, lockAdmin, unlockAdmin } from '../../admin';
import {
  ADMIN_CASH,
  ALL_LOCATIONS,
  finishQuests,
  giveAllOutfits,
  isAdminWorld,
  markAdmin,
  maxHappiness,
  setInfiniteMoney,
  setLevel,
  topUpCash,
  unlockAllCities,
} from '@/game/admin';
import { ACTIVITIES } from '@/game/activities';
import { CITIES, CITY_META } from '@/world/cities';
import { travelTo, enterBuilding } from '../../interact';
import { money } from '../../format';
import type { LocationId } from '@/game/types';
import type { BuildingDef } from '@/game/content';

export function AdminApp() {
  const on = useAdmin((s) => s.on);
  return on ? <AdminPanel /> : <AdminLock />;
}

function AdminLock() {
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'wrong'>('idle');
  const submit = async () => {
    setState('checking');
    if (await unlockAdmin(code)) {
      playSfx('unlock');
      useUI.getState().pushToast({ text: 'Admin mode on', icon: '🔑', tone: 'gold' });
    } else {
      playSfx('error');
      setState('wrong');
    }
  };
  return (
    <Section title="Admin">
      <p className="small" style={{ marginTop: 0 }}>
        For the Fin City team only. Enter the admin code to unlock full control on this device.
      </p>
      <form
        className="col"
        style={{ gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="input"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setState('idle');
          }}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          aria-label="Admin code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <Button variant="gold" disabled={!code.trim() || state === 'checking'} onClick={submit}>
          {state === 'checking' ? 'Checking...' : 'Unlock'}
        </Button>
        {state === 'wrong' && <span className="small">That code isn&apos;t right.</span>}
      </form>
    </Section>
  );
}

/** Where to stand outside a building's front door, facing it. */
function doorSpot(b: BuildingDef) {
  const [cx, cz] = b.pos;
  const [w, d] = b.size;
  const off = { north: [0, -(d / 2 + 3)], south: [0, d / 2 + 3], east: [w / 2 + 3, 0], west: [-(w / 2 + 3), 0] }[b.door];
  const x = cx + off[0];
  const z = cz + off[1];
  return { x, z, rot: Math.atan2(cx - x, cz - z) };
}

function AdminPanel() {
  const w = useGame((s) => s.world!);
  const here = useScene((s) => s.location);
  const [city, setCity] = useState<LocationId>(here);
  const [flying, setFlying] = useState(rt.flying);
  const [boost, setBoost] = useState(rt.speedBoost);
  const infinite = w.progress.flags.adminInfinite === true;
  const entry = w.difficulty === 'entry';

  // Keep the flying button in step with double-taps of Space
  useEffect(() => {
    const id = setInterval(() => setFlying(rt.flying), 300);
    return () => clearInterval(id);
  }, []);

  const acts = useMemo(() => ACTIVITIES.filter((a) => a.city === city && (entry ? a.entry : a.advanced)), [city, entry]);
  const buildings = CITIES[city].buildings;
  const toast = (text: string) => useUI.getState().pushToast({ text, icon: '🔑', tone: 'gold' });
  const power = (fn: Parameters<typeof act>[0], text: string) => {
    playSfx('coin');
    act(fn);
    toast(text);
  };

  const goCity = (to: LocationId, spawn?: { x: number; z: number; rot: number }) => {
    act((d) => {
      markAdmin(d);
      if (!d.progress.unlocked.includes(to)) d.progress.unlocked.push(to);
    });
    travelTo(to, spawn ?? null);
  };
  const goBuilding = (b: BuildingDef) => {
    if (city !== here || useScene.getState().interior) {
      // Travel to the door, then walk in once the city has loaded
      goCity(city, doorSpot(b));
      const started = Date.now();
      const id = setInterval(() => {
        const sc = useScene.getState();
        if (Date.now() - started > 20000) return clearInterval(id);
        if (sc.location !== city || sc.interior || useUI.getState().loading.active || !rt.triggers.length) return;
        clearInterval(id);
        enterBuilding(b.id);
      }, 300);
      return;
    }
    const s = doorSpot(b);
    rt.player.set(s.x, 0, s.z);
    rt.playerRotY = s.rot;
    act((d) => markAdmin(d));
    enterBuilding(b.id);
  };

  return (
    <div>
      <Section title="Admin mode" right={<Button size="small" variant="ghost" onClick={() => lockAdmin()}>Lock</Button>}>
        <p className="small" style={{ marginTop: 0 }}>
          {isAdminWorld(w) ? 'This is an admin world, so it stays off the leaderboard.' : 'Using any power below makes this an admin world, which keeps it off the leaderboard.'}
        </p>
      </Section>

      <Section title="Money and level">
        <div className="row wrap" style={{ gap: 6 }}>
          <Button size="small" variant={infinite ? 'ghost' : 'gold'} onClick={() => power((d) => setInfiniteMoney(d, !infinite), infinite ? 'Infinite money off' : `Infinite money on (${money(ADMIN_CASH, { cents: false })})`)}>
            💰 {infinite ? 'Infinite money: on' : 'Infinite money'}
          </Button>
          <Button size="small" onClick={() => power((d) => { markAdmin(d); d.finance.cash += 1_000_000; }, '+$1,000,000')}>
            +$1M cash
          </Button>
          <Button size="small" onClick={() => power((d, fx) => setLevel(d, fx, Math.max(d.progress.level + 10, 25)), 'Level up!')}>
            ⭐ +10 levels
          </Button>
          <Button size="small" onClick={() => power((d, fx) => setLevel(d, fx, 99), 'Max level')}>
            👑 Max level
          </Button>
          <Button size="small" onClick={() => power((d) => maxHappiness(d), 'Happiness 100')}>
            Happiness 100
          </Button>
        </div>
      </Section>

      <Section title="Unlock everything">
        <div className="row wrap" style={{ gap: 6 }}>
          <Button size="small" onClick={() => power((d, fx) => unlockAllCities(d, fx), 'Every city unlocked')}>
            🌀 All cities
          </Button>
          <Button size="small" onClick={() => power((d, fx) => finishQuests(d, fx, false), 'Tutorial finished')}>
            Finish tutorial
          </Button>
          <Button size="small" onClick={() => power((d, fx) => finishQuests(d, fx, true), 'Every quest finished')}>
            📜 Finish all quests
          </Button>
          <Button size="small" onClick={() => power((d) => giveAllOutfits(d), 'Every outfit is yours')}>
            Every outfit
          </Button>
        </div>
      </Section>

      <Section title="Fly and move">
        <p className="small" style={{ marginTop: 0 }}>Double-tap Space to fly. Hold Space to go up and Shift to go down. Land to stop flying.</p>
        <div className="row wrap" style={{ gap: 6 }}>
          <Button
            size="small"
            variant={flying ? 'ghost' : 'gold'}
            onClick={() => {
              rt.flying = !rt.flying;
              if (rt.flying) rt.playerVel.y = 4;
              setFlying(rt.flying);
              act((d) => markAdmin(d));
            }}
          >
            🚀 {flying ? 'Stop flying' : 'Fly'}
          </Button>
          {[1, 2, 4].map((n) => (
            <Button
              key={n}
              size="small"
              variant={boost === n ? 'gold' : 'ghost'}
              onClick={() => {
                rt.speedBoost = n;
                setBoost(n);
                if (n > 1) act((d) => markAdmin(d));
              }}
            >
              ⚡ {n}x speed
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Go anywhere">
        <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
          {ALL_LOCATIONS.map((loc) => (
            <Button key={loc} size="small" variant={city === loc ? 'gold' : 'ghost'} onClick={() => setCity(loc)}>
              {CITY_META[loc].icon} {CITY_META[loc].name}
            </Button>
          ))}
        </div>
        <Button size="small" variant="blue" onClick={() => goCity(city)}>
          📍 Go to {CITY_META[city].name}
        </Button>
        <div className="col" style={{ gap: 4, marginTop: 8 }}>
          {buildings.map((b) => (
            <div key={b.id} className="row between" style={{ gap: 6 }}>
              <span className="small">
                {b.icon} {b.name}
              </span>
              <Button size="small" onClick={() => goBuilding(b)}>
                Go
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Play any activity (${CITY_META[city].name})`}>
        <div className="col" style={{ gap: 4 }}>
          {acts.map((a) => (
            <div key={a.id} className="row between" style={{ gap: 6 }}>
              <span className="small">
                {a.icon} {a.name}
              </span>
              <Button
                size="small"
                onClick={() => {
                  act((d) => markAdmin(d));
                  useUI.getState().open({ type: 'activity', id: a.id });
                }}
              >
                Play
              </Button>
            </div>
          ))}
          {!acts.length && <span className="small muted">No activities here in this mode.</span>}
        </div>
      </Section>
    </div>
  );
}

/** Runs in the HUD: loads the device's admin unlock and keeps infinite money topped up. */
export function AdminWatcher() {
  useEffect(() => {
    loadAdmin();
    const id = setInterval(() => {
      const w = useGame.getState().world;
      if (!w || !useAdmin.getState().on || w.progress.flags.adminInfinite !== true || w.finance.cash >= ADMIN_CASH / 2) return;
      act((d) => void topUpCash(d));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return null;
}
