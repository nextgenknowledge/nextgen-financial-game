'use client';
/** State for activities that run in the 3D world (driving deliveries). */
export interface DeliveryOrder {
  dish: string;
  x: number;
  z: number;
  label: string;
  baseTip: number;
  delivered: boolean;
  tip: number;
}

export interface DeliveryRun {
  activityId: string;
  orders: DeliveryOrder[];
  pickup: { x: number; z: number };
  pickedUp: boolean;
  timeLimit: number;
  elapsed: number;
  pickupAt: number;
  meters: number;
  fuelPerMeter: number;
  lastX: number;
  lastZ: number;
}

export const worldRun: { pending: null | { activityId: string; orders: number; time: number; fuel: number }; run: DeliveryRun | null } = {
  pending: null,
  run: null,
};

export function requestDelivery(activityId: string, orders: number, time: number, fuel: number) {
  worldRun.pending = { activityId, orders, time, fuel };
}
