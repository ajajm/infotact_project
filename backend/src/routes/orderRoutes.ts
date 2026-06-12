import { Router } from 'express';
import { 
  checkout, 
  routeAndFulfillOrder, 
  syncOfflineOrders, 
  getOrders, 
  getAnalytics 
} from '../controllers/orderController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Retrieve orders - cashiers, managers, admins
router.get('/', authenticate, getOrders);

// Financial reports / Dashboard analytics - managers and admins only
router.get('/analytics', authenticate, requireRole(['admin', 'manager']), getAnalytics);

// Process checkouts and syncs - cashiers, managers, admins
router.post('/checkout', authenticate, checkout);
router.post('/route', authenticate, routeAndFulfillOrder);
router.post('/sync-offline', authenticate, syncOfflineOrders);

export default router;
