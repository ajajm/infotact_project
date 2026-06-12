import { Router } from 'express';
import { createStore, getStores, getStoreById } from '../controllers/storeController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Retrieve stores - allowed for any authenticated user
router.get('/', authenticate, getStores);
router.get('/:id', authenticate, getStoreById);

// Create store - restricted to Administrators
router.post('/', authenticate, requireRole(['admin']), createStore);

export default router;
