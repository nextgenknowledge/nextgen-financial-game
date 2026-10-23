import vehiclesData from '@/data/shop/vehicles.json';

export type VehicleType = 'bike' | 'scooter' | 'car' | 'boat' | 'plane' | 'kart';

export interface VehicleDef {
  id: string;
  name: string;
  type: VehicleType;
  price: number;
  topSpeed: number;
  accel: number;
  turn: number;
  depreciation: number;
  upkeep: number;
  color: string;
  icon: string;
  happiness: number;
  blurb: string;
  leaseable?: boolean;
  unlockLevel?: number;
  repairRisk?: number;
  bizBoost?: number;
}

export const VEHICLES = vehiclesData.items as VehicleDef[];
const BY_ID = new Map(VEHICLES.map((v) => [v.id, v]));
export const RENTAL_SCOOTER: VehicleDef = { ...BY_ID.get('scooter')!, id: 'rental-scooter', name: 'Delivery Scooter', color: '#e1553f', price: 0 };

export function vehicleDef(id: string): VehicleDef | undefined {
  return id === 'rental-scooter' ? RENTAL_SCOOTER : BY_ID.get(id);
}
