import { expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/store/settings';

it('new players start with the Narwhal, its trail and hints switched on', () => {
  expect(DEFAULT_SETTINGS.hints).toBe(true);
  expect(DEFAULT_SETTINGS.narwhalFollow).toBe(true);
});
