'use client';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { rt } from '@/engine/runtime';
import { mountVehicle, dismountVehicle } from '@/engine/vehicles';
import { useScene } from '@/store/scene';
import { useUI } from '@/store/ui';
import { act } from '@/store/game';
import { ACTIVITY_BY_ID } from '@/game/activities';
import { finishActivity } from '@/game/progress/activities';
import { receive } from '@/game/finance/accounts';
import { makeRng, randomSeed } from '@/game/rng';
import { playSfx } from '@/engine/audio';
import { worldRun, type DeliveryOrder } from './delivery';
import { useRide } from '@/world/ParkedVehicles';

const DISHES = ['🥟 Har gow', '🍜 Wonton noodles', '🥮 Egg tarts', '🍚 Fried rice', '🥢 Siu mai', '🍤 Shrimp rolls'];

/** Runs world activities (deliveries): checkpoints, timer, tips, fuel, and the final payout. */
export function WorldActivityRunner() {
  const hudT = useRef(0);
  useFrame((_, dt) => {
    const scene = useScene.getState();
    const ui = useUI.getState();
    // Start a pending delivery once we're outside and loaded
    if (worldRun.pending && !scene.interior && !ui.loading.active && rt.triggers.length) {
      const p = worldRun.pending;
      worldRun.pending = null;
      const rng = makeRng(randomSeed());
      const door = rt.triggers.find((t) => t.id === 'door:dim-sum') ?? { x: rt.player.x, z: rt.player.z };
      const targets = rng.shuffle(rt.triggers.filter((t) => t.kind === 'door' && t.id !== 'door:dim-sum' && Math.hypot(t.x - door.x, t.z - door.z) > 30));
      const orders: DeliveryOrder[] = targets.slice(0, p.orders).map((t, i) => ({
        dish: DISHES[i % DISHES.length],
        x: t.x,
        z: t.z,
        label: t.label.replace('Enter ', ''),
        baseTip: rng.int(8, 14),
        delivered: false,
        tip: 0,
      }));
      worldRun.run = { activityId: p.activityId, orders, pickup: { x: door.x, z: door.z }, pickedUp: false, timeLimit: p.time, elapsed: 0, pickupAt: 0, meters: 0, fuelPerMeter: p.fuel, lastX: door.x, lastZ: door.z };
      mountVehicle('rental', 'rental-scooter', door.x, door.z, rt.playerRotY);
      useRide.getState().set('rental');
      ui.sayNarwhal('Grab the orders right here, then follow the gold light to each customer. Go go go! 🛵', 'hyped');
    }
    const run = worldRun.run;
    if (!run) return;
    if (scene.interior || ui.panel?.type === 'pause') return;
    run.elapsed += dt;
    const x = rt.player.x;
    const z = rt.player.z;
    run.meters += Math.hypot(x - run.lastX, z - run.lastZ);
    run.lastX = x;
    run.lastZ = z;
    if (!run.pickedUp) {
      rt.goal = { id: 'pickup', x: run.pickup.x, z: run.pickup.z, label: 'Pick up' };
      if (Math.hypot(x - run.pickup.x, z - run.pickup.z) < 4) {
        run.pickedUp = true;
        run.pickupAt = run.elapsed;
        playSfx('pop');
      }
    } else {
      const next = run.orders.find((o) => !o.delivered);
      if (next) {
        rt.goal = { id: 'drop', x: next.x, z: next.z, label: next.label };
        if (Math.hypot(x - next.x, z - next.z) < 4.5) {
          const waited = run.elapsed - run.pickupAt;
          next.delivered = true;
          next.tip = Math.max(1, Math.round(next.baseTip * Math.max(0.15, 1 - waited / (run.timeLimit * 1.1)) * 100) / 100);
          playSfx('cash');
          ui.pushToast({ text: `Delivered ${next.dish}! Tip $${next.tip.toFixed(2)}`, icon: '🛵', tone: 'good' });
        }
      }
    }
    const done = run.orders.every((o) => o.delivered);
    if (done || run.elapsed >= run.timeLimit) {
      finish(run, done);
      return;
    }
    hudT.current += dt;
    if (hudT.current > 0.25) {
      hudT.current = 0;
      const left = run.orders.filter((o) => !o.delivered);
      ui.setWorldActivity({
        id: run.activityId,
        data: {
          title: '🛵 Dim Sum Delivery',
          timeLeft: run.timeLimit - run.elapsed,
          lines: [
            run.pickedUp ? `Orders left: ${left.length} · next: ${left[0]?.label ?? '-'}` : 'Pick up the food at Golden Dragon!',
            `Tips so far: $${run.orders.reduce((s, o) => s + o.tip, 0).toFixed(2)} · Fuel: $${(run.meters * run.fuelPerMeter).toFixed(2)}`,
          ],
        },
      });
    }
  });
  return null;
}

function finish(run: NonNullable<typeof worldRun.run>, allDone: boolean) {
  worldRun.run = null;
  rt.goal = null;
  const ui = useUI.getState();
  ui.setWorldActivity(null);
  if (rt.vehicle?.uid === 'rental') {
    rt.vehicle.speed = 0;
    dismountVehicle();
    useRide.getState().set(null);
  }
  const delivered = run.orders.filter((o) => o.delivered);
  const fee = 5;
  const tips = delivered.reduce((s, o) => s + o.tip, 0);
  const fuel = run.meters * run.fuelPerMeter;
  const earned = Math.round((delivered.length * fee + tips - fuel) * 100) / 100;
  const max = run.orders.length * (fee + 12);
  const score = Math.max(0, Math.min(100, (earned / max) * 100 * 1.25));
  const def = ACTIVITY_BY_ID.get(run.activityId);
  act((w, fx) => {
    if (earned > 0) receive(w, earned, 'Delivery earnings');
    if (def) finishActivity(w, fx, def, { score, noCash: true, earned });
    fx.push({
      type: 'narwhal',
      text: `${allDone ? 'All orders delivered!' : `Time's up, ${delivered.length}/${run.orders.length} delivered.`} Fees $${(delivered.length * fee).toFixed(2)} + tips $${tips.toFixed(2)} − fuel $${fuel.toFixed(2)} = $${earned.toFixed(2)} profit. ${fuel > tips * 0.4 ? 'Shorter routes would save fuel!' : 'Nice efficient route!'}`,
      mood: earned > max * 0.5 ? 'hyped' : 'talking',
    });
  });
}
