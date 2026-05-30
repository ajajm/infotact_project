import { Router } from 'express';
import { 
  createProduct, 
  getProducts, 
  getProductById, 
  getProductBySku, 
  updateProduct, 
  deleteProduct 
} from '../controllers/productController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Retrieve catalog - open to cashier, manager, admin
router.get('/', authenticate, getProducts);
router.get('/sku/:sku', authenticate, getProductBySku);
router.get('/:id', authenticate, getProductById);

// Modify catalog - open to manager and admin
router.post('/', authenticate, requireRole(['admin', 'manager']), createProduct);
router.put('/:id', authenticate, requireRole(['admin', 'manager']), updateProduct);

// Delete product - open to admin only (due to cascading inventory deletion rules)
router.delete('/:id', authenticate, requireRole(['admin']), deleteProduct);

export default router;
// GET /prescriptions/:id/pdf - streams PDF buffer with Content-Disposition
