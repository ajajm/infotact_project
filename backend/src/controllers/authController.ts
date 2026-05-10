import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Store } from '../models/Store.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['cashier', 'manager', 'admin']).default('cashier'),
  storeCode: z.string().optional(), // Can look up storeId by store code
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string(),
});

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.errors });
    }

    const { name, email, password, role, storeCode } = validation.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    let storeId;
    if (storeCode) {
      const store = await Store.findOne({ code: storeCode.toUpperCase() });
      if (!store) {
        return res.status(404).json({ message: `Store with code '${storeCode}' not found.` });
      }
      storeId = store._id;
    }

    const passwordHash = await hashPassword(password);

    const user = new User({
      name,
      email,
      passwordHash,
      role,
      storeId,
    });

    await user.save();

    const token = generateToken({
      userId: user._id.toString(),
      role: user.role,
      storeId: user.storeId?.toString(),
    });

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeId: user.storeId,
      },
    });
  } catch (error: any) {
    console.error('Error during registration:', error);
    return res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
};

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.errors });
    }

    const { email, password } = validation.data;

    const user = await User.findOne({ email }).populate('storeId');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken({
      userId: user._id.toString(),
      role: user.role,
      storeId: user.storeId?.toString(),
    });

    return res.status(200).json({
      message: 'Logged in successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeId: user.storeId ? {
          id: user.storeId._id,
          name: (user.storeId as any).name,
          code: (user.storeId as any).code,
        } : undefined,
      },
    });
  } catch (error: any) {
    console.error('Error during login:', error);
    return res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
};

export const me = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(req.user.userId).populate('storeId');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeId: user.storeId,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error retrieving identity.', error: error.message });
  }
};
// Auth controller: register + login with Zod schema validation
