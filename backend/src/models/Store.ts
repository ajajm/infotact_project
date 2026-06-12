import { Schema, model, Document } from 'mongoose';

export interface IStore extends Document {
  name: string;
  code: string;
  address: {
    street?: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  createdAt: Date;
  updatedAt: Date;
}

const StoreSchema = new Schema<IStore>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    address: {
      street: String,
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
      zip: { type: String, required: true, trim: true },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Geo-spatial index for location routing
StoreSchema.index({ location: '2dsphere' });

export const Store = model<IStore>('Store', StoreSchema);
