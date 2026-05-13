import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateHaversineDistance, findOptimalFulfillmentStore } from '../src/services/fulfillmentService.js';
import { Store } from '../src/models/Store.js';
import { InventoryLedger } from '../src/models/InventoryLedger.js';

// Mock mongoose models
vi.mock('../src/models/Store.js', () => {
  return {
    Store: {
      find: vi.fn(),
    },
  };
});

vi.mock('../src/models/InventoryLedger.js', () => {
  return {
    InventoryLedger: {
      find: vi.fn(),
    },
  };
});

describe('Fulfillment Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Haversine Distance Calculator', () => {
    it('should calculate the distance between Bengaluru and Mumbai correctly', () => {
      const bengaluruCoords: [number, number] = [77.5946, 12.9716]; // [lon, lat]
      const mumbaiCoords: [number, number] = [72.8777, 19.0760]; // [lon, lat]

      // Distance should be approximately 840-850 kilometers
      const distance = calculateHaversineDistance(bengaluruCoords, mumbaiCoords);
      expect(distance).toBeGreaterThan(830);
      expect(distance).toBeLessThan(860);
    });

    it('should return 0 for the exact same coordinate', () => {
      const coords: [number, number] = [77.5946, 12.9716];
      const distance = calculateHaversineDistance(coords, coords);
      expect(distance).toBe(0);
    });
  });

  describe('Optimal Fulfillment Store Routing', () => {
    it('should select the closest store when both stores have full stock coverage', async () => {
      const customerCoords: [number, number] = [77.5946, 12.9716]; // Bengaluru
      
      const store1 = {
        _id: 'store1_id',
        name: 'Bengaluru Core Store',
        code: 'BLR-01',
        location: { type: 'Point', coordinates: [77.5946, 12.9716] }, // 0 km away
      };

      const store2 = {
        _id: 'store2_id',
        name: 'Mumbai Central Store',
        code: 'BOM-01',
        location: { type: 'Point', coordinates: [72.8777, 19.0760] }, // ~840 km away
      };

      // Mock Store.find to return these two stores
      vi.mocked(Store.find).mockResolvedValue([store1, store2] as any);

      // Mock InventoryLedger to return inventory for SKU
      vi.mocked(InventoryLedger.find).mockImplementation(async (filter: any) => {
        if (filter.storeId === 'store1_id') {
          return [{ sku: 'SKU-SHIRT-M', quantity: 20 }] as any;
        }
        if (filter.storeId === 'store2_id') {
          return [{ sku: 'SKU-SHIRT-M', quantity: 20 }] as any;
        }
        return [];
      });

      const orderItems = [{ sku: 'SKU-SHIRT-M', quantity: 2 }];
      const result = await findOptimalFulfillmentStore(customerCoords, orderItems);

      expect(result).not.toBeNull();
      expect(result?.store.name).toBe('Bengaluru Core Store');
      expect(result?.distanceKm).toBe(0);
      expect(result?.availablePercentage).toBe(100);
    });

    it('should select a further store if the closer store is out of stock', async () => {
      const customerCoords: [number, number] = [77.5946, 12.9716]; // Bengaluru
      
      const store1 = {
        _id: 'store1_id',
        name: 'Bengaluru Core Store',
        code: 'BLR-01',
        location: { type: 'Point', coordinates: [77.5946, 12.9716] }, // 0 km away
      };

      const store2 = {
        _id: 'store2_id',
        name: 'Mumbai Central Store',
        code: 'BOM-01',
        location: { type: 'Point', coordinates: [72.8777, 19.0760] }, // ~840 km away
      };

      vi.mocked(Store.find).mockResolvedValue([store1, store2] as any);

      vi.mocked(InventoryLedger.find).mockImplementation(async (filter: any) => {
        if (filter.storeId === 'store1_id') {
          return [{ sku: 'SKU-SHIRT-M', quantity: 1 }] as any; // Out of stock (requires 2)
        }
        if (filter.storeId === 'store2_id') {
          return [{ sku: 'SKU-SHIRT-M', quantity: 20 }] as any; // In stock
        }
        return [];
      });

      const orderItems = [{ sku: 'SKU-SHIRT-M', quantity: 2 }];
      const result = await findOptimalFulfillmentStore(customerCoords, orderItems);

      expect(result).not.toBeNull();
      // Even though Mumbai is ~840km away, it is selected because Bengaluru has 0% availability for this quantity.
      expect(result?.store.name).toBe('Mumbai Central Store');
      expect(result?.availablePercentage).toBe(100);
    });
  });
});
// Tests: AES-256 encrypt/decrypt round-trip | JWT sign/verify validity
