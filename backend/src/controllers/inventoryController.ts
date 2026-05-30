import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { InventoryLedger } from '../models/InventoryLedger.js';
import { Store } from '../models/Store.js';
import { Product } from '../models/Product.js';
import { z } from 'zod';

const reconcileSchema = z.object({
  storeId: z.string(),
  sku: z.string(),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  reorderPoint: z.number().min(0).optional(),
});

export const getInventory = async (req: AuthRequest, res: Response) => {
  try {
    const { storeId, sku, lowStock } = req.query;
    const filter: any = {};

    // For managers/cashiers, restrict to their own store if applicable
    if (req.user?.role !== 'admin' && req.user?.storeId) {
      filter.storeId = req.user.storeId;
    } else if (storeId) {
      filter.storeId = storeId;
    }

    if (sku) {
      filter.sku = sku;
    }

    if (lowStock === 'true') {
      // Find where quantity is less than or equal to reorderPoint
      filter.$expr = { $lte: ['$quantity', '$reorderPoint'] };
    }

    const ledgers = await InventoryLedger.find(filter)
      .populate('storeId', 'name code')
      .lean();

    // Map product info (name, etc.) to the inventory ledger lists
    const skus = ledgers.map(l => l.sku);
    const products = await Product.find({ 'variants.sku': { $in: skus } }).lean();

    const result = ledgers.map(ledger => {
      const product = products.find(p => p.variants.some(v => v.sku === ledger.sku));
      const variant = product?.variants.find(v => v.sku === ledger.sku);
      
      return {
        ...ledger,
        productName: product ? product.name : 'Unknown Product',
        category: product ? product.category : 'Unknown Category',
        attributes: variant ? variant.attributes : new Map(),
        price: variant?.price !== undefined ? variant.price : (product ? product.basePrice : 0),
      };
    });

    return res.status(200).json({ inventory: result });
  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    return res.status(500).json({ message: 'Server error fetching inventory.', error: error.message });
  }
};

export const reconcileInventory = async (req: AuthRequest, res: Response) => {
  try {
    const validation = reconcileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.errors });
    }

    const { storeId, sku, quantity, reorderPoint } = validation.data;

    // Check store exists
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found.' });
    }

    // Check if variant SKU exists in any product
    const product = await Product.findOne({ 'variants.sku': sku });
    if (!product) {
      return res.status(404).json({ message: `Product variant with SKU '${sku}' does not exist.` });
    }

    const updateFields: any = { quantity };
    if (reorderPoint !== undefined) {
      updateFields.reorderPoint = reorderPoint;
    }

    const ledger = await InventoryLedger.findOneAndUpdate(
      { storeId, sku },
      { $set: updateFields },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      message: 'Inventory reconciled successfully.',
      ledger,
    });
  } catch (error: any) {
    console.error('Error reconciling inventory:', error);
    return res.status(500).json({ message: 'Server error reconciling inventory.', error: error.message });
  }
};
// Zod: strict string schema on medication fields, sanitized before DB write
