'use client';
import type { KindProps } from '../types';
import { Button, ReadAloud } from '@/ui/common';
import { useUI } from '@/store/ui';
import { requestDelivery } from '../world/delivery';
import { exitBuilding } from '@/ui/interact';
import { money } from '@/ui/format';

/** Briefing screen: the delivery itself happens in the 3D city on a scooter. */
export default function Delivery({ def, params, difficulty }: KindProps<{ orders: number; time: number; fuel: number }>) {
  const entry = difficulty === 'entry';
  const text = entry
    ? `Pick up ${params.orders} orders here, then ride the scooter to each glowing spot. Faster deliveries get bigger tips!`
    : `Pick up ${params.orders} orders, then deliver them anywhere in the city within ${params.time} seconds. Tips shrink the longer food waits. Fuel costs ${money(params.fuel)} per meter, plan the shortest route!`;
  return (
    <div className="col" style={{ gap: 12, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: '4rem' }}>🛵🥟</div>
      <p style={{ fontSize: '1.2rem', fontWeight: 800, maxWidth: 560 }}>
        {text} <ReadAloud text={text} />
      </p>
      <p className="small muted">Drive: W/S gas & brake, A/D steer, Shift boost. Follow the gold beam and the arrow at the top of the screen.</p>
      <Button
        variant="gold"
        size="huge"
        onClick={() => {
          requestDelivery(def.id, params.orders, params.time, params.fuel);
          useUI.getState().closeAll();
          exitBuilding();
        }}
      >
        Hop on the scooter! 🛵
      </Button>
    </div>
  );
}
