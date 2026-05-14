import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Order } from '../models/Order.js';
import { Store } from '../models/Store.js';
import { processCheckoutTransaction } from '../services/inventoryService.js';
import { findOptimalFulfillmentStore } from '../services/fulfillmentService.js';
import { z } from 'zod';
import mongoose from 'mongoose';

const checkoutItemSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  discount: z.number().min(0).max(100).optional(),
});

const checkoutSchema = z.object({
  storeId: z.string(),
  customer: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
  }).optional(),
  items: z.array(checkoutItemSchema).min(1, 'Must contain at least 1 item'),
  paymentMethod: z.enum(['cash', 'credit', 'digital_wallet']),
});

const routeSchema = z.object({
  customerLocation: z.object({
    coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
  }),
  customer: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
  }).optional(),
  items: z.array(checkoutItemSchema).min(1, 'Must contain at least 1 item'),
  paymentMethod: z.enum(['cash', 'credit', 'digital_wallet']),
});

export const checkout = async (req: AuthRequest, res: Response) => {
  try {
    const validation = checkoutSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.errors });
    }

    const { storeId, customer, items, paymentMethod } = validation.data;
    const cashierId = req.user?.userId;

    const order = await processCheckoutTransaction({
      storeId,
      cashierId,
      customer,
      items,
      paymentMethod,
      offlineSync: false,
    });

    return res.status(201).json({
      message: 'Checkout completed successfully.',
      order,
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return res.status(400).json({ message: 'Checkout failed.', error: error.message });
  }
};

export const routeAndFulfillOrder = async (req: AuthRequest, res: Response) => {
  try {
    const validation = routeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.errors });
    }

    const { customerLocation, customer, items, paymentMethod } = validation.data;

    // 1. Run optimization engine to find best store node
    const routingResult = await findOptimalFulfillmentStore(customerLocation.coordinates, items);
    if (!routingResult) {
      return res.status(404).json({ message: 'No stores available for routing.' });
    }

    if (routingResult.availablePercentage === 0) {
      return res.status(400).json({ 
        message: 'Order cannot be fulfilled. Out of stock at all geographic nodes.',
        routing: routingResult
      });
    }

    // 2. Process checkout at the selected store
    const storeId = routingResult.store._id.toString();
    const order = await processCheckoutTransaction({
      storeId,
      customer,
      items,
      paymentMethod,
      offlineSync: false,
    });

    return res.status(201).json({
      message: `Order routed and fulfilled successfully at Store: ${routingResult.store.name} (${routingResult.store.code})`,
      order,
      routing: {
        storeName: routingResult.store.name,
        storeCode: routingResult.store.code,
        distanceKm: routingResult.distanceKm,
        stockCoveragePercentage: routingResult.availablePercentage
      }
    });
  } catch (error: any) {
    console.error('Order routing checkout error:', error);
    return res.status(400).json({ message: 'Order routing checkout failed.', error: error.message });
  }
};

export const syncOfflineOrders = async (req: AuthRequest, res: Response) => {
  try {
    const { orders } = req.body;
    if (!Array.isArray(orders)) {
      return res.status(400).json({ message: 'Invalid payload. Orders must be an array.' });
    }

    const results = {
      success: [] as any[],
      failed: [] as any[],
    };

    for (const offlineOrder of orders) {
      try {
        // Prevent duplicate processing
        const existingOrder = await Order.findOne({ orderNumber: offlineOrder.orderNumber });
        if (existingOrder) {
          results.success.push({ orderNumber: offlineOrder.orderNumber, status: 'already_synced', id: existingOrder._id });
          continue;
        }

        const order = await processCheckoutTransaction({
          storeId: offlineOrder.storeId,
          cashierId: offlineOrder.cashierId || req.user?.userId,
          customer: offlineOrder.customer,
          items: offlineOrder.items,
          paymentMethod: offlineOrder.paymentMethod,
          offlineSync: true,
          createdAt: offlineOrder.createdAt ? new Date(offlineOrder.createdAt) : new Date(),
        });

        results.success.push({ orderNumber: order.orderNumber, status: 'synced', id: order._id });
      } catch (error: any) {
        console.error(`Offline sync error for order: ${offlineOrder.orderNumber}`, error);
        results.failed.push({
          orderNumber: offlineOrder.orderNumber,
          error: error.message || 'Transaction processing failed',
        });
      }
    }

    return res.status(200).json({
      message: `Sync process completed. Success: ${results.success.length}, Failed: ${results.failed.length}`,
      results,
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error during offline sync processing.', error: error.message });
  }
};

export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    const storeId = req.query.storeId as string;

    const filter: any = {};

    // Cashiers and Managers are locked to their store's orders
    if (req.user?.role !== 'admin' && req.user?.storeId) {
      filter.storeId = req.user.storeId;
    } else if (storeId) {
      filter.storeId = storeId;
    }

    const skip = (page - 1) * limit;
    const orders = await Order.find(filter)
      .populate('storeId', 'name code')
      .populate('cashierId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCount = await Order.countDocuments(filter);

    return res.status(200).json({
      orders,
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ message: 'Server error retrieving orders.', error: error.message });
  }
};

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    const filter: any = {};

    if (req.user?.role !== 'admin' && req.user?.storeId) {
      filter.storeId = new mongoose.Types.ObjectId(req.user.storeId);
    } else if (storeId && mongoose.Types.ObjectId.isValid(storeId)) {
      filter.storeId = new mongoose.Types.ObjectId(storeId);
    }

    // 1. Total revenue, tax, discount & transaction counts
    const generalStats = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalTax: { $sum: '$totalTax' },
          totalDiscount: { $sum: '$totalDiscount' },
          totalTransactions: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    // 2. Revenue breakdown by payment method
    const paymentBreakdown = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentMethod',
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // 3. Sales trends (daily totals for the last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyFilter = {
      ...filter,
      createdAt: { $gte: sevenDaysAgo }
    };

    const salesTrend = await Order.aggregate([
      { $match: dailyFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const stats = generalStats[0] || {
      totalRevenue: 0,
      totalTax: 0,
      totalDiscount: 0,
      totalTransactions: 0,
      avgOrderValue: 0,
    };

    return res.status(200).json({
      revenue: stats.totalRevenue,
      tax: stats.totalTax,
      discount: stats.totalDiscount,
      transactions: stats.totalTransactions,
      averageValue: stats.avgOrderValue,
      paymentBreakdown,
      salesTrend,
    });
  } catch (error: any) {
    console.error('Analytics aggregation error:', error);
    return res.status(500).json({ message: 'Server error generating analytics.', error: error.message });
  }
};
// Patient CRUD: GET decrypts PHI fields before sending response
