import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Store } from '../models/Store.js';
import { Product } from '../models/Product.js';
import { InventoryLedger } from '../models/InventoryLedger.js';
import { hashPassword } from '../utils/auth.js';
import { connectDB } from '../config/db.js';

const seed = async () => {
  try {
    console.log('🌱 Starting database seeding process...');
    
    // Connect DB
    await connectDB();

    // Clear existing data
    await User.deleteMany({});
    await Store.deleteMany({});
    await Product.deleteMany({});
    await InventoryLedger.deleteMany({});
    console.log('🧹 Cleared existing tables.');

    // 1. Create Stores
    const storeBlr = new Store({
      name: 'Bengaluru Electronics Hub',
      code: 'STORE-BLR-01',
      address: {
        street: '80 Feet Rd, Koramangala',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        zip: '560034',
      },
      location: {
        type: 'Point',
        coordinates: [77.5946, 12.9716], // [longitude, latitude]
      },
    });

    const storeBom = new Store({
      name: 'Mumbai Fashion Arcade',
      code: 'STORE-BOM-01',
      address: {
        street: 'Linking Rd, Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        zip: '400050',
      },
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.0760], // [longitude, latitude]
      },
    });

    await storeBlr.save();
    await storeBom.save();
    console.log('🏬 Created stores: Bangalore & Mumbai.');

    // 2. Create Users
    const adminPasswordHash = await hashPassword('admin123');
    const cashierPasswordHash = await hashPassword('cashier123');

    const admin = new User({
      name: 'System Administrator',
      email: 'admin@retail.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
    });

    const cashierBlr = new User({
      name: 'Rohan Cashier (Bangalore)',
      email: 'cashier@retail.com',
      passwordHash: cashierPasswordHash,
      role: 'cashier',
      storeId: storeBlr._id,
    });

    const managerBom = new User({
      name: 'Pooja Manager (Mumbai)',
      email: 'manager@retail.com',
      passwordHash: cashierPasswordHash,
      role: 'manager',
      storeId: storeBom._id,
    });

    await admin.save();
    await cashierBlr.save();
    await managerBom.save();
    console.log('👤 Created accounts: Admin, Cashier, Manager.');

    // 3. Create Catalog Products and Variants
    const prod1 = new Product({
      name: 'iPhone 15 Pro Max',
      description: 'Apple iPhone 15 Pro Max with titanium body, A17 Pro chip.',
      category: 'Electronics > Mobiles',
      basePrice: 139900,
      taxRate: 18, // 18% GST
      variants: [
        { sku: 'SKU-IPH15-BLK', attributes: new Map([['color', 'Black Titanium'], ['storage', '256GB']]) },
        { sku: 'SKU-IPH15-NAT', attributes: new Map([['color', 'Natural Titanium'], ['storage', '256GB']]) },
      ],
    });

    const prod2 = new Product({
      name: 'Samsung Galaxy S24 Ultra',
      description: 'Samsung flagship smartphone with Galaxy AI capabilities.',
      category: 'Electronics > Mobiles',
      basePrice: 124900,
      taxRate: 18,
      variants: [
        { sku: 'SKU-S24U-GRY', attributes: new Map([['color', 'Titanium Gray'], ['storage', '512GB']]) },
        { sku: 'SKU-S24U-BLK', attributes: new Map([['color', 'Titanium Black'], ['storage', '256GB']]) },
      ],
    });

    const prod3 = new Product({
      name: 'Sony WH-1000XM5 Headphones',
      description: 'Industry-leading noise canceling wireless overhead headphones.',
      category: 'Electronics > Audio',
      basePrice: 29900,
      taxRate: 18,
      variants: [
        { sku: 'SKU-XM5-BLK', attributes: new Map([['color', 'Silver Matte']]) },
      ],
    });

    const prod4 = new Product({
      name: "Levi's 501 Original Fit Jeans",
      description: 'Classic straight-leg denim jeans with button fly closure.',
      category: 'Apparel > Men > Jeans',
      basePrice: 4299,
      taxRate: 5, // 5% GST
      variants: [
        { sku: 'SKU-LEV-32', attributes: new Map([['size', '32'], ['color', 'Dark Blue']]) },
        { sku: 'SKU-LEV-34', attributes: new Map([['size', '34'], ['color', 'Dark Blue']]) },
      ],
    });

    await prod1.save();
    await prod2.save();
    await prod3.save();
    await prod4.save();
    console.log('🏷 Created product catalog & SKU variants.');

    // 4. Initialize Inventory Levels for variants in Stores
    const allProducts = [prod1, prod2, prod3, prod4];
    
    for (const product of allProducts) {
      for (const variant of product.variants) {
        // High stock in Bangalore
        const ledgerBlr = new InventoryLedger({
          storeId: storeBlr._id,
          sku: variant.sku,
          quantity: 45,
          reorderPoint: 10,
          salesVelocity: 0,
        });

        // Medium stock in Mumbai
        const ledgerBom = new InventoryLedger({
          storeId: storeBom._id,
          sku: variant.sku,
          quantity: 15,
          reorderPoint: 10,
          salesVelocity: 0,
        });

        await ledgerBlr.save();
        await ledgerBom.save();
      }
    }

    console.log('📦 Initialized inventory levels for all store SKUs.');
    console.log('🎉 Database seeding successfully completed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding process crashed:', error);
    process.exit(1);
  }
};

seed();
// Room tokens: crypto.randomBytes(32).toString('hex') per appointment
