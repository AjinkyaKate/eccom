const express = require('express');
const {
  getProducts,
  searchProducts,
  getProductBySlug,
} = require('../controllers/product.controller');

const router = express.Router();

router.get('/', getProducts);
router.get('/search', searchProducts);
router.get('/:slug', getProductBySlug);

module.exports = router;
