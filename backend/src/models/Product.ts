import { Schema, model, Document } from 'mongoose';

export interface IProductVariant {
  sku: string; // Unique SKU/Barcode
  attributes: Map<string, string>; // size: M, color: Black, etc.
  price?: number; // Optional override of basePrice
}

export interface IProduct extends Document {
  name: string;
  description?: string;
  category: string; // e.g. "Apparel > Men > Shirts"
  basePrice: number;
  taxRate: number; // e.g. 18 for 18% GST
  variants: IProductVariant[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>({
  sku: {
    type: String,
    required: true,
    unique: true, // Note: Unique index will be created on the nested field across all documents
    trim: true,
    index: true,
  },
  attributes: {
    type: Map,
    of: String,
    default: {},
  },
  price: {
    type: Number,
    min: 0,
  },
});

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      required: true,
      min: 0,
      default: 0, // In percentage, e.g., 18
    },
    variants: [ProductVariantSchema],
  },
  {
    timestamps: true,
  }
);

// Create compound full-text search index for search functionality
ProductSchema.index(
  {
    name: 'text',
    description: 'text',
    category: 'text',
    'variants.sku': 'text',
  },
  {
    weights: {
      name: 10,
      'variants.sku': 8,
      category: 5,
      description: 2,
    },
    name: 'ProductTextIndex',
  }
);

export const Product = model<IProduct>('Product', ProductSchema);
