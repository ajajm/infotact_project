import { Schema, model, Document, Types } from 'mongoose';

export interface IInventoryLedger extends Document {
  storeId: Types.ObjectId;
  sku: string;
  quantity: number;
  reorderPoint: number;
  salesVelocity: number; // Avg units sold per day
  createdAt: Date;
  updatedAt: Date;
}

const InventoryLedgerSchema = new Schema<IInventoryLedger>(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reorderPoint: {
      type: Number,
      required: true,
      min: 0,
      default: 10, // Default threshold for low-stock alerts
    },
    salesVelocity: {
      type: Number,
      required: true,
      min: 0,
      default: 0, // Used for predictive reorder triggers
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique compound index on storeId + sku to prevent duplicate entries
InventoryLedgerSchema.index({ storeId: 1, sku: 1 }, { unique: true });

export const InventoryLedger = model<IInventoryLedger>('InventoryLedger', InventoryLedgerSchema);
