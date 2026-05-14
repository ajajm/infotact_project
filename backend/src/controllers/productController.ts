import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Product } from '../models/Product.js';
import { InventoryLedger } from '../models/InventoryLedger.js';
import { Store } from '../models/Store.js';
import { cacheGet, cacheSet, cacheFlushPattern } from '../utils/cache.js';
import { z } from 'zod';
import mongoose from 'mongoose';

const variantSchema = z.object({
  sku: z.string().min(2, 'SKU must be at least 2 characters'),
  attributes: z.record(z.string()),
  price: z.number().min(0).optional(),
});

const productCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  category: z.string().min(2, 'Category is required'),
  basePrice: z.number().min(0, 'Base price must be positive'),
  taxRate: z.number().min(0).max(100).default(0),
  variants: z.array(variantSchema).min(1, 'At least one variant is required'),
  initialStock: z.object({
    storeId: z.string(),
    quantity: z.number().min(0),
  }).optional(),
});

const productUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  category: z.string().min(2).optional(),
  basePrice: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  variants: z.array(variantSchema).optional(),
});

export const createProduct = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const validation = productCreateSchema.safeParse(req.body);
    if (!validation.success) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ errors: validation.error.errors });
    }

    const { name, description, category, basePrice, taxRate, variants, initialStock } = validation.data;

    // Check duplicate SKUs in database
    const skus = variants.map(v => v.sku);
    const existingSku = await Product.findOne({ 'variants.sku': { $in: skus } }).session(session);
    if (existingSku) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'One or more SKU values already exist in the database.' });
    }

    const product = new Product({
      name,
      description,
      category,
      basePrice,
      taxRate,
      variants,
    });

    await product.save({ session });

    // Initialize inventory for variants if initialStock is provided
    if (initialStock) {
      const store = await Store.findById(initialStock.storeId).session(session);
      if (!store) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Initial stock store not found.' });
      }

      for (const variant of variants) {
        const ledger = new InventoryLedger({
          storeId: store._id,
          sku: variant.sku,
          quantity: initialStock.quantity,
          reorderPoint: 10,
          salesVelocity: 0,
        });
        await ledger.save({ session });
      }
    } else {
      // Initialize inventory ledger rows as 0 for all stores in system to prevent empty records
      const stores = await Store.find().session(session);
      for (const store of stores) {
        for (const variant of variants) {
          const ledger = new InventoryLedger({
            storeId: store._id,
            sku: variant.sku,
            quantity: 0,
            reorderPoint: 10,
            salesVelocity: 0,
          });
          await ledger.save({ session });
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Invalidate Redis cache
    await cacheFlushPattern('products:*');

    return res.status(201).json({
      message: 'Product and variants created successfully.',
      product,
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error creating product:', error);
    return res.status(500).json({ message: 'Server error creating product.', error: error.message });
  }
};

export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const cursor = req.query.cursor as string; // Last product ID
    const search = req.query.search as string;

    const cacheKey = `products:list:cursor_${cursor || 'none'}_limit_${limit}_search_${search || 'none'}`;
    const cachedResponse = await cacheGet(cacheKey);

    if (cachedResponse) {
      return res.status(200).json(cachedResponse);
    }

    let query: any = {};
    
    // Process cursor pagination (assuming sorting by _id ascending)
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $gt: new mongoose.Types.ObjectId(cursor) };
    }

    let products;
    let totalCount;

    if (search) {
      // If full text search is enabled, filter using text index
      // Text search score sorting can override cursor ID sorting
      const textQuery = { $text: { $search: search } };
      
      // Standard search combined with cursor
      if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
        query = {
          ...textQuery,
          _id: { $gt: new mongoose.Types.ObjectId(cursor) }
        };
      } else {
        query = textQuery;
      }

      products = await Product.find(query)
        .select({ score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, _id: 1 })
        .limit(limit);

      totalCount = await Product.countDocuments(textQuery);
    } else {
      products = await Product.find(query)
        .sort({ _id: 1 })
        .limit(limit);

      totalCount = await Product.countDocuments();
    }

    const nextCursor = products.length === limit ? products[products.length - 1]._id.toString() : null;
    
    const responseData = {
      products,
      nextCursor,
      totalCount,
      hasMore: !!nextCursor,
    };

    // Cache products list for 10 minutes (600s)
    await cacheSet(cacheKey, responseData, 600);

    return res.status(200).json(responseData);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ message: 'Server error fetching products.', error: error.message });
  }
};

export const getProductById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const cacheKey = `products:detail:${id}`;
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.status(200).json({ product: cached });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    await cacheSet(cacheKey, product, 600);

    return res.status(200).json({ product });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error fetching product.', error: error.message });
  }
};

export const getProductBySku = async (req: AuthRequest, res: Response) => {
  try {
    const { sku } = req.params;
    const cacheKey = `products:sku:${sku}`;
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.status(200).json(cached);
    }

    const product = await Product.findOne({ 'variants.sku': sku });
    if (!product) {
      return res.status(404).json({ message: `Product variant with SKU '${sku}' not found.` });
    }

    // Find the specific variant within the product array
    const variant = product.variants.find(v => v.sku === sku);

    const result = {
      productId: product._id,
      name: product.name,
      description: product.description,
      category: product.category,
      taxRate: product.taxRate,
      basePrice: product.basePrice,
      variant: variant,
      price: variant?.price !== undefined ? variant.price : product.basePrice,
    };

    await cacheSet(cacheKey, result, 600);

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error looking up SKU.', error: error.message });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = productUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.errors });
    }

    const product = await Product.findByIdAndUpdate(id, { $set: validation.data }, { new: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Invalidate Redis cache
    await cacheFlushPattern('products:*');

    return res.status(200).json({
      message: 'Product updated successfully.',
      product,
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error updating product.', error: error.message });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const product = await Product.findById(id).session(session);
    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Product not found.' });
    }

    const skus = product.variants.map(v => v.sku);

    // Delete product
    await Product.findByIdAndDelete(id).session(session);

    // Cascade delete related inventory ledger records
    await InventoryLedger.deleteMany({ sku: { $in: skus } }).session(session);

    await session.commitTransaction();
    session.endSession();

    // Invalidate Redis cache
    await cacheFlushPattern('products:*');

    return res.status(200).json({ message: 'Product and related inventory records deleted successfully.' });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: 'Server error deleting product.', error: error.message });
  }
};
// Zod schemas enforce strict types - blocks injection and XSS
