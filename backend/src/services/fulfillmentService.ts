import { Store, IStore } from '../models/Store.js';
import { InventoryLedger } from '../models/InventoryLedger.js';
import mongoose from 'mongoose';

interface RoutingItem {
  sku: string;
  quantity: number;
}

interface RoutedStoreResult {
  store: IStore;
  distanceKm: number;
  availablePercentage: number;
  score: number; // Combined optimization metric
}

/**
 * Calculates the Haversine distance between two points on the Earth.
 * @param coords1 [longitude, latitude] of first point
 * @param coords2 [longitude, latitude] of second point
 * @returns distance in kilometers
 */
export const calculateHaversineDistance = (coords1: [number, number], coords2: [number, number]): number => {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;
  const R = 6371; // Earth radius in km
  
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Computes the optimal fulfillment store based on stock availability and distance.
 * Optimization Score = AvailabilityWeight * (Stock Availability %) - DistanceWeight * (Distance in km)
 */
export const findOptimalFulfillmentStore = async (
  customerCoords: [number, number], // [longitude, latitude]
  items: RoutingItem[]
): Promise<RoutedStoreResult | null> => {
  try {
    const stores = await Store.find();
    if (stores.length === 0) return null;

    const skuList = items.map(item => item.sku);

    const storeScores: RoutedStoreResult[] = [];

    for (const store of stores) {
      // Fetch inventory ledgers for all requested SKUs at this store
      const ledgers = await InventoryLedger.find({
        storeId: store._id,
        sku: { $in: skuList },
      });

      // Calculate what percentage of items this store can fully satisfy
      let satisfiedItemsCount = 0;
      for (const item of items) {
        const ledger = ledgers.find(l => l.sku === item.sku);
        if (ledger && ledger.quantity >= item.quantity) {
          satisfiedItemsCount++;
        }
      }

      const availablePercentage = items.length > 0 ? (satisfiedItemsCount / items.length) * 100 : 0;
      
      // Compute Haversine distance
      const storeCoords = store.location.coordinates;
      const distanceKm = calculateHaversineDistance(customerCoords, storeCoords);

      // Score optimization formula:
      // We prioritize stock availability. If a store cannot satisfy any items, it gets low priority.
      // Score = (availability %) * 10 - (distance in km) * 0.5
      // If a store can satisfy 100% of the items, score increases by 200 points to strongly favor complete orders.
      let score = (availablePercentage * 10) - (distanceKm * 0.5);
      if (availablePercentage === 100) {
        score += 200; // Strong bonus for complete order fulfillment
      }

      storeScores.push({
        store,
        distanceKm: Math.round(distanceKm * 100) / 100,
        availablePercentage,
        score,
      });
    }

    // Sort by score descending
    storeScores.sort((a, b) => b.score - a.score);

    return storeScores[0] || null;
  } catch (error) {
    console.error('Error finding optimal fulfillment store:', error);
    throw error;
  }
};
