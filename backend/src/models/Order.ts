import { Schema, model, Document, Types } from 'mongoose';

export interface IOrderLineItem {
  sku: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number; // calculated tax for this line
  discountAmount: number; // calculated discount for this line
  total: number; // final line total: (unitPrice * quantity) + taxAmount - discountAmount
}

export interface IOrder extends Document {
  orderNumber: string;
  storeId: Types.ObjectId;
  cashierId?: Types.ObjectId; // Empty for online/storefront checkout
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  items: IOrderLineItem[];
  totalAmount: number;
  totalTax: number;
  totalDiscount: number;
  paymentMethod: 'cash' | 'credit' | 'digital_wallet';
  paymentStatus: 'paid' | 'refunded' | 'pending';
  offlineSync: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrderLineItemSchema = new Schema<IOrderLineItem>({
  sku: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  taxAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
});

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    cashierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    customer: {
      name: String,
      phone: String,
      email: String,
    },
    items: [OrderLineItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalTax: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalDiscount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'credit', 'digital_wallet'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'refunded', 'pending'],
      required: true,
      default: 'paid',
    },
    offlineSync: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Add index on storeId + createdAt for revenue and reporting lookups
OrderSchema.index({ storeId: 1, createdAt: -1 });

export const Order = model<IOrder>('Order', OrderSchema);
