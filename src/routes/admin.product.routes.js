const express = require('express');
const {
  getAdminProducts,
  createProduct,
  updateProduct,
  updateProductStock,
  deleteProduct,
} = require('../controllers/product.controller');
const { protect } = require('../middlewares/auth.middleware');
const { adminOnly } = require('../middlewares/admin.middleware');

const router = express.Router();

router.use(protect, adminOnly);

router.get('/', getAdminProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
