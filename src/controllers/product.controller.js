const mongoose = require('mongoose');
const Category = require('../models/Category');
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

const buildListStages = async (query, options = {}) => {
  const { includeInactive = false } = options;
  const { category, search, sort, minPrice, maxPrice, inStock, isFeatured, isActive } = query;

  const match = {};

  if (!includeInactive) {
    match.isActive = true;
  } else {
    const isActiveFilter = parseBoolean(isActive);
    if (isActiveFilter !== undefined) {
      match.isActive = isActiveFilter;
    }
  }

  const inStockFilter = parseBoolean(inStock);
  if (inStockFilter === true) {
    match.stock = { $gt: 0 };
  } else if (inStockFilter === false) {
    match.stock = 0;
  }

  const featuredFilter = parseBoolean(isFeatured);
  if (featuredFilter !== undefined) {
    match.isFeatured = featuredFilter;
  }

  const categoryId = await resolveCategoryFilter(category);
  if (categoryId === '__no_match__') {
    return [{ $match: { _id: null } }];
  }

  if (categoryId) {
    match.category = new mongoose.Types.ObjectId(categoryId);
  }

  const stages = [{ $match: match }, buildComputedFieldsStage()];

  const normalizedSearch = typeof search === 'string' ? search.trim() : '';
  if (normalizedSearch) {
    const safeSearch = escapeRegex(normalizedSearch);
    stages.push({
      $match: {
        $or: [
          { name: { $regex: safeSearch, $options: 'i' } },
          { shortDescription: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } },
          { tags: { $elemMatch: { $regex: safeSearch, $options: 'i' } } },
        ],
      },
    });
  }

  const priceClauses = [];
  const parsedMinPrice = parseNumber(minPrice);
  const parsedMaxPrice = parseNumber(maxPrice);

  if (parsedMinPrice !== undefined) {
    priceClauses.push({ finalPrice: { $gte: parsedMinPrice } });
  }

  if (parsedMaxPrice !== undefined) {
    priceClauses.push({ finalPrice: { $lte: parsedMaxPrice } });
  }

  if (priceClauses.length === 1) {
    stages.push({ $match: priceClauses[0] });
  } else if (priceClauses.length > 1) {
    stages.push({ $match: { $and: priceClauses } });
  }

  const sortMap = {
    price_asc: { finalPrice: 1, createdAt: -1 },
    price_desc: { finalPrice: -1, createdAt: -1 },
    newest: { createdAt: -1 },
    popular: { soldCount: -1, ratingAverage: -1, createdAt: -1 },
  };

  stages.push({
    $addFields: {
      ratingAverage: '$rating.average',
    },
  });

  stages.push({ $sort: sortMap[sort] || { createdAt: -1 } });
  stages.push(buildCategoryLookupStage());
  stages.push({
    $unwind: {
      path: '$category',
      preserveNullAndEmptyArrays: true,
    },
  });
  stages.push(buildProductProjectionStage());

  return stages;
};

const pickProductPayload = (body = {}) => {
  const payload = {};

  if (body.name !== undefined) payload.name = body.name;
  if (body.description !== undefined) payload.description = body.description;
  if (body.shortDescription !== undefined) payload.shortDescription = body.shortDescription;
  if (body.category !== undefined) payload.category = body.category;
  if (body.price !== undefined) payload.price = parseNumber(body.price);
  if (body.discountPrice !== undefined) {
    payload.discountPrice =
      body.discountPrice === null || body.discountPrice === ''
        ? null
        : parseNumber(body.discountPrice);
  }
  if (body.stock !== undefined) payload.stock = parseNumber(body.stock);
  if (body.sku !== undefined) payload.sku = body.sku;
  if (body.mainImage !== undefined) payload.mainImage = body.mainImage;
  if (body.images !== undefined) payload.images = normalizeStringArray(body.images);
  if (body.tags !== undefined) payload.tags = normalizeStringArray(body.tags);
  if (body.specifications !== undefined) payload.specifications = body.specifications || {};

  const featured = parseBoolean(body.isFeatured);
  if (featured !== undefined) payload.isFeatured = featured;

  const active = parseBoolean(body.isActive);
  if (active !== undefined) payload.isActive = active;

  return payload;
};

const validateBaseProductPayload = async (payload, { isUpdate = false } = {}) => {
  if (!isUpdate) {
    const requiredFields = ['name', 'category', 'price', 'stock', 'sku'];
    const missingField = requiredFields.find(
      (field) => payload[field] === undefined || payload[field] === null || payload[field] === ''
    );

    if (missingField) {
      return `${missingField} is required`;
    }
  }

  if (payload.price !== undefined && payload.price < 0) {
    return 'Price cannot be negative';
  }

  if (payload.stock !== undefined && payload.stock < 0) {
    return 'Stock cannot be negative';
  }

  if (
    payload.discountPrice !== undefined &&
    payload.discountPrice !== null &&
    payload.price !== undefined &&
    payload.discountPrice >= payload.price
  ) {
    return 'Discount price must be less than regular price';
  }

  if (payload.category !== undefined) {
    if (!mongoose.Types.ObjectId.isValid(payload.category)) {
      return 'Invalid category';
    }

    const category = await Category.findById(payload.category).select('_id isActive');
    if (!category) {
      return 'Category not found';
    }

    if (!category.isActive) {
      return 'Cannot assign product to an inactive category';
    }
  }

  return null;
};

const getProducts = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const baseStages = await buildListStages(req.query);
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

    const baseStages = await buildListStages({ ...req.query, search: q });
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
    const baseStages = await buildListStages(req.query, { includeInactive: true });
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
    const validationError = await validateBaseProductPayload(payload);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const product = await Product.create({
      ...payload,
      createdBy: req.user.userId,
    });

    const populatedProduct = await Product.findById(product._id)
      .populate('category', 'name slug image isActive')
      .select('-__v');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        product: populatedProduct,
      },
    });
  } catch (error) {
    console.error('Create Product Error:', error);

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(409).json({
        success: false,
        message: `${duplicateField} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
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

    const payload = pickProductPayload(req.body);
    const mergedPayload = {
      price: payload.price !== undefined ? payload.price : product.price,
      discountPrice:
        payload.discountPrice !== undefined ? payload.discountPrice : product.discountPrice,
      stock: payload.stock !== undefined ? payload.stock : product.stock,
      category: payload.category !== undefined ? payload.category : product.category.toString(),
    };

    const validationError = await validateBaseProductPayload(
      { ...payload, ...mergedPayload },
      { isUpdate: true }
    );

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    Object.entries(payload).forEach(([key, value]) => {
      product[key] = value;
    });

    await product.save();

    const updatedProduct = await Product.findById(product._id)
      .populate('category', 'name slug image isActive')
      .select('-__v');

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: {
        product: updatedProduct,
      },
    });
  } catch (error) {
    console.error('Update Product Error:', error);

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(409).json({
        success: false,
        message: `${duplicateField} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
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
