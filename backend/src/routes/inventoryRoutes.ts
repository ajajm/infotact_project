import { Router } from 'express';
import { getInventory, reconcileInventory } from '../controllers/inventoryController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Retrieve inventory levels - cashiers, managers, and admins
router.get('/', authenticate, getInventory);

// Reconcile stock count - managers and admins only
router.put('/reconcile', authenticate, requireRole(['admin', 'manager']), reconcileInventory);

export default router;
// MedicalRecord GET: cursor pagination for large longitudinal datasets
