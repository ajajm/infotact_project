import mongoose from 'mongoose';
import { InventoryLedger } from '../models/InventoryLedger.js';
import { Order, IOrderLineItem } from '../models/Order.js';
import { Product } from '../models/Product.js';

interface CheckoutPayload {
  storeId: string;
  cashierId?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  items: {
    sku: string;
    quantity: number;
    discount?: number; // Optional discount percentage (e.g., 10 for 10% off)
  }[];
  paymentMethod: 'cash' | 'credit' | 'digital_wallet';
  offlineSync?: boolean;
  createdAt?: Date; // Custom date for historical order sync
}

/**
 * Processes checkout transactions atomically.
 * Decrements stock, updates sales velocity, calculates taxes & discounts, and records the order.
 */
export const processCheckoutTransaction = async (payload: CheckoutPayload) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { storeId, cashierId, customer, items, paymentMethod, offlineSync = false, createdAt } = payload;
    
    const lineItems: IOrderLineItem[] = [];
    let totalAmount = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const item of items) {
      // 1. Verify product and variant exist
      const product = await Product.findOne({ 'variants.sku': item.sku }).session(session);
      if (!product) {
        throw new Error(`Product variant with SKU '${item.sku}' not found.`);
      }

      const variant = product.variants.find(v => v.sku === item.sku);
      if (!variant) {
        throw new Error(`Variant metadata missing for SKU '${item.sku}'.`);
      }

      const unitPrice = variant.price !== undefined ? variant.price : product.basePrice;
      const taxRate = product.taxRate; // e.g. 18 for 18%

      // 2. Fetch and verify inventory levels
      let ledger = await InventoryLedger.findOne({ storeId, sku: item.sku }).session(session);
      if (!ledger) {
        // Create ledger row on the fly if it doesn't exist yet
        ledger = new InventoryLedger({
          storeId: new mongoose.Types.ObjectId(storeId),
          sku: item.sku,
          quantity: 0,
          reorderPoint: 10,
          salesVelocity: 0,
        });
      }

      if (ledger.quantity < item.quantity) {
        throw new Error(`Insufficient stock for SKU '${item.sku}'. Requested: ${item.quantity}, Available: ${ledger.quantity}`);
      }

      // 3. Decrement inventory stock atomically
      ledger.quantity -= item.quantity;
      
      // Update sales velocity (rolling calculation: add sales and smooth over time)
      // Moving average sales velocity: V_new = V_old * 0.9 + Quantity_sold * 0.1
      ledger.salesVelocity = ledger.salesVelocity * 0.9 + item.quantity * 0.1;

      // Predict new reorder point dynamically based on sales velocity
      // Formula: Reorder Point = (Sales Velocity * Lead Time of 5 days) + Safety Buffer of 5 units
      const calculatedReorderPoint = Math.ceil((ledger.salesVelocity * 5) + 5);
      ledger.reorderPoint = Math.max(10, calculatedReorderPoint); // Enforce min threshold of 10

      await ledger.save({ session });

      // 4. Calculate prices, taxes, and discounts
      const baseSubtotal = unitPrice * item.quantity;
      
      // Apply discount if provided
      let discountAmount = 0;
      if (item.discount && item.discount > 0) {
        discountAmount = baseSubtotal * (item.discount / 100);
      }
      
      const discountedSubtotal = baseSubtotal - discountAmount;
      const taxAmount = discountedSubtotal * (taxRate / 100);
      const lineTotal = discountedSubtotal + taxAmount;

      lineItems.push({
        sku: item.sku,
        quantity: item.quantity,
        unitPrice,
        taxAmount: Math.round(taxAmount * 100) / 100,
        discountAmount: Math.round(discountAmount * 100) / 100,
        total: Math.round(lineTotal * 100) / 100,
      });

      totalAmount += lineTotal;
      totalTax += taxAmount;
      totalDiscount += discountAmount;
    }

    // Generate unique order number (e.g. ORD-<timestamp>-<rand>)
    const timestamp = Date.now();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${timestamp}-${rand}`;

    // 5. Create the Order
    const order = new Order({
      orderNumber,
      storeId,
      cashierId,
      customer,
      items: lineItems,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      paymentMethod,
      paymentStatus: 'paid',
      offlineSync,
      createdAt: createdAt || new Date(),
    });

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return order;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
