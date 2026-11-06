import { beforeEach, expect, it, vi } from 'vitest';

// The 3D model and sound aren't needed to check what happens to a sold vehicle.
vi.mock('@/world/Vehicles', () => ({ VehicleModel: () => null }));
vi.mock('@/engine/audio', () => ({ playSfx: () => {} }));

import { rt } from '@/engine/runtime';
import { mountVehicle } from '@/engine/vehicles';
import { dropUnowned, useRide } from '@/world/ParkedVehicles';

beforeEach(() => {
  rt.vehicle = null;
  rt.parked = null;
  rt.collision = { inWater: () => false } as unknown as typeof rt.collision;
  useRide.getState().set(null);
});

it('gets you off a vehicle you sold while riding it', () => {
  mountVehicle('veh_a', 'used-hatch', 10, 10, 0);
  useRide.getState().set('veh_a');
  expect(dropUnowned(['veh_b'])).toBe(true);
  expect(rt.vehicle).toBeNull();
  expect(useRide.getState().riding).toBeNull();
});

it('removes a sold vehicle that was parked or summoned', () => {
  rt.parked = { uid: 'veh_a', itemId: 'used-hatch', x: 1, z: 2, rot: 0, scene: 'park' };
  expect(dropUnowned([])).toBe(false);
  expect(rt.parked).toBeNull();
});

it('leaves vehicles you still own, and the delivery scooter, alone', () => {
  mountVehicle('veh_a', 'used-hatch', 10, 10, 0);
  expect(dropUnowned(['veh_a'])).toBe(false);
  expect(rt.vehicle?.uid).toBe('veh_a');
  mountVehicle('rental', 'rental-scooter', 0, 0, 0);
  expect(dropUnowned([])).toBe(false);
  expect(rt.vehicle?.uid).toBe('rental');
});
