const mongoose = require('mongoose');
const Product = require('../models/Product');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseBoolean = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }

    if (value.toLowerCase() === 'false') {
      return false;
    }
  }

  return undefined;
};

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const normalizeStringArray = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => item.toString().trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const buildComputedFieldsStage = () => ({
  $addFields: {
    finalPrice: {
      $cond: [
        {
          $and: [
            { $ne: ['$discountPrice', null] },
            { $gt: ['$discountPrice', 0] },
          ],
        },
        '$discountPrice',
        '$price',
      ],
    },
    discountPercentage: {
      $cond: [
        {
          $and: [
            { $ne: ['$discountPrice', null] },
            { $gt: ['$discountPrice', 0] },
            { $lt: ['$discountPrice', '$price'] },
          ],
        },
        {
          $round: [
            {
              $multiply: [
                {
                  $divide: [{ $subtract: ['$price', '$discountPrice'] }, '$price'],
                },
                100,
              ],
            },
            0,
          ],
        },
        0,
      ],
    },
    inStock: {
      $gt: ['$stock', 0],
    },
  },
});

const buildCategoryLookupStage = () => ({
  $lookup: {
    from: 'categories',
    localField: 'category',
    foreignField: '_id',
    pipeline: [
      {
        $project: {
          _id: 1,
          name: 1,
          slug: 1,
          image: 1,
          isActive: 1,
        },
      },
    ],
    as: 'category',
  },
});

const buildProductProjectionStage = () => ({
  $project: {
    __v: 0,
    'category.__v': 0,
  },
});

const resolveCategoryFilter = async (categoryValue) => {
  if (!categoryValue) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(categoryValue)) {
    return categoryValue;
  }

  const category = await Category.findOne({ slug: categoryValue }).select('_id');
  return category ? category._id : '__no_match__';
};

const buildListStages = (query, options = {}) => {
  const { includeInactive = false } = options;
  const { search, sort, isFeatured, isActive } = query;

  const match = {};

  if (!includeInactive) {
    match.isActive = true;
  } else {
    const isActiveFilter = parseBoolean(isActive);
    if (isActiveFilter !== undefined) match.isActive = isActiveFilter;
  }

  const featuredFilter = parseBoolean(isFeatured);
  if (featuredFilter !== undefined) match.isFeatured = featuredFilter;

  const stages = [{ $match: match }];

  const normalizedSearch = typeof search === 'string' ? search.trim() : '';
  if (normalizedSearch) {
    const safeSearch = escapeRegex(normalizedSearch);
    stages.push({
      $match: {
        $or: [
          { name: { $regex: safeSearch, $options: 'i' } },
          { shortDescription: { $regex: safeSearch, $options: 'i' } },
          { tags: { $elemMatch: { $regex: safeSearch, $options: 'i' } } },
        ],
      },
    });
  }

  const sortMap = {
    newest: { createdAt: -1 },
    popular: { soldCount: -1, createdAt: -1 },
  };

  stages.push({ $sort: sortMap[sort] || { createdAt: -1 } });
  stages.push({ $project: { __v: 0 } });

  return stages;
};

const pickProductPayload = (body = {}) => {
  const payload = {};

  if (body.name !== undefined) payload.name = body.name;
  if (body.description !== undefined) payload.description = body.description;
  if (body.shortDescription !== undefined) payload.shortDescription = body.shortDescription;
  if (body.mainImage !== undefined) payload.mainImage = body.mainImage;
  if (body.images !== undefined) payload.images = normalizeStringArray(body.images);
  if (body.tags !== undefined) payload.tags = normalizeStringArray(body.tags);
  if (body.specifications !== undefined) payload.specifications = body.specifications || {};

  const featured = parseBoolean(body.isFeatured);
  if (featured !== undefined) payload.isFeatured = featured;

  const active = parseBoolean(body.isActive);
  if (active !== undefined) payload.isActive = active;

  if (Array.isArray(body.variants)) {
    payload.variants = body.variants.map((v) => ({
      name: v.name,
      price: parseNumber(v.price) ?? 0,
      discountPrice: v.discountPrice === '' || v.discountPrice == null ? null : parseNumber(v.discountPrice),
      stock: parseNumber(v.stock) ?? 0,
      sku: v.sku || undefined,
      isActive: v.isActive !== false,
    }));
  }

  return payload;
};

const validateBaseProductPayload = (payload, { isUpdate = false } = {}) => {
  if (!isUpdate && (!payload.name || payload.name.trim() === '')) {
    return 'Product name is required';
  }

  if (Array.isArray(payload.variants)) {
    for (const v of payload.variants) {
      if (!v.name || v.name.trim() === '') return 'Each variant must have a name';
      if (v.price === undefined || v.price < 0) return 'Each variant must have a valid price';
      if (v.discountPrice !== null && v.discountPrice !== undefined && v.discountPrice >= v.price) {
        return `Variant "${v.name}": discount price must be less than regular price`;
      }
    }
  }

  return null;
};

const getProducts = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const baseStages = buildListStages(req.query);
    const itemsPipeline = [...baseStages, { $skip: skip }, { $limit: limit }];
    const countPipeline = [...baseStages, { $count: 'total' }];

    const [products, countResult] = await Promise.all([
      Product.aggregate(itemsPipeline),
      Product.aggregate(countPipeline),
    ]);

    const totalProducts = countResult[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: buildPaginationMeta({ page, limit, totalItems: totalProducts }),
      },
    });
  } catch (error) {
    console.error('Get Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const searchProducts = async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const baseStages = buildListStages({ ...req.query, search: q });
    const products = await Product.aggregate([...baseStages, { $limit: 20 }]);

    res.status(200).json({
      success: true,
      data: {
        products,
        count: products.length,
      },
    });
  } catch (error) {
    console.error('Search Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug, isActive: true })
      .populate('category', 'name slug image isActive')
      .select('-__v');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    console.error('Get Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const getAdminProducts = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const baseStages = buildListStages(req.query, { includeInactive: true });
    const itemsPipeline = [...baseStages, { $skip: skip }, { $limit: limit }];
    const countPipeline = [...baseStages, { $count: 'total' }];

    const [products, countResult] = await Promise.all([
      Product.aggregate(itemsPipeline),
      Product.aggregate(countPipeline),
    ]);

    const totalProducts = countResult[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: buildPaginationMeta({ page, limit, totalItems: totalProducts }),
      },
    });
  } catch (error) {
    console.error('Get Admin Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const createProduct = async (req, res) => {
  try {
    const payload = pickProductPayload(req.body);
    const validationError = validateBaseProductPayload(payload);

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const product = await Product.create({ ...payload, createdBy: req.user.userId });
    const saved = await Product.findById(product._id).select('-__v');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product: saved },
    });
  } catch (error) {
    console.error('Create Product Error:', error);
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(409).json({ success: false, message: `${duplicateField} already exists` });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const payload = pickProductPayload(req.body);
    const validationError = validateBaseProductPayload(payload, { isUpdate: true });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    Object.entries(payload).forEach(([key, value]) => { product[key] = value; });
    await product.save();

    const updated = await Product.findById(product._id).select('-__v');
    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product: updated },
    });
  } catch (error) {
    console.error('Update Product Error:', error);
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(409).json({ success: false, message: `${duplicateField} already exists` });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const updateProductStock = async (req, res) => {
  try {
    const { id } = req.params;
    const quantity = parseNumber(req.body.quantity);
    const operation = req.body.operation;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product id',
      });
    }

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid quantity is required',
      });
    }

    if (!['add', 'subtract', 'set'].includes(operation)) {
      return res.status(400).json({
        success: false,
        message: 'Operation must be add, subtract, or set',
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const oldStock = product.stock;

    if (operation === 'add') {
      product.stock += quantity;
    } else if (operation === 'subtract') {
      product.stock = Math.max(0, product.stock - quantity);
    } else {
      product.stock = quantity;
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: {
        oldStock,
        newStock: product.stock,
      },
    });
  } catch (error) {
    console.error('Update Product Stock Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product id',
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  getProducts,
  searchProducts,
  getProductBySlug,
  getAdminProducts,
  createProduct,
  updateProduct,
  updateProductStock,
  deleteProduct,
};
