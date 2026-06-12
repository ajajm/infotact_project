import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Store } from '../models/Store.js';
import { z } from 'zod';

const storeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters'),
  address: z.object({
    street: z.string().optional(),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    country: z.string().min(2, 'Country is required'),
    zip: z.string().min(4, 'ZIP is required'),
  }),
  location: z.object({
    coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
  }),
});

export const createStore = async (req: AuthRequest, res: Response) => {
  try {
    const validation = storeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.errors });
    }

    const { name, code, address, location } = validation.data;

    // Check unique code
    const existingStore = await Store.findOne({ code: code.toUpperCase() });
    if (existingStore) {
      return res.status(400).json({ message: `Store with code '${code}' already exists.` });
    }

    const store = new Store({
      name,
      code: code.toUpperCase(),
      address,
      location: {
        type: 'Point',
        coordinates: location.coordinates,
      },
    });

    await store.save();

    return res.status(201).json({
      message: 'Store created successfully.',
      store,
    });
  } catch (error: any) {
    console.error('Error creating store:', error);
    return res.status(500).json({ message: 'Server error creating store.', error: error.message });
  }
};

export const getStores = async (req: AuthRequest, res: Response) => {
  try {
    const stores = await Store.find();
    return res.status(200).json({ stores });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error retrieving stores.', error: error.message });
  }
};

export const getStoreById = async (req: AuthRequest, res: Response) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }
    return res.status(200).json({ store });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error retrieving store.', error: error.message });
  }
};
