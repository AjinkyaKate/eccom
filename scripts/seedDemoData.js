require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');

const categories = [
  {
    name: 'Electronics',
    description: 'Phones, laptops, headphones, and accessories',
    image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c',
    displayOrder: 1,
  },
  {
    name: 'Home Appliances',
    description: 'Everyday appliances for kitchen and home use',
    image: 'https://images.unsplash.com/photo-1586208958839-06c17cacdf08',
    displayOrder: 2,
  },
  {
    name: 'Fashion',
    description: 'Trending apparel and accessories',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050',
    displayOrder: 3,
  },
];

const products = [
  {
    name: 'MacBook Pro M3',
    description: 'Powerful Apple laptop for creators and developers.',
    shortDescription: '16GB RAM, 512GB SSD, 14-inch display',
    categoryName: 'Electronics',
    price: 199900,
    discountPrice: 179900,
    stock: 12,
    sku: 'ELEC-MBP-001',
    mainImage: 'https://images.unsplash.com/photo-1517336714739-489689fd1ca8',
    images: [
      'https://images.unsplash.com/photo-1517336714739-489689fd1ca8',
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853',
    ],
    specifications: {
      brand: 'Apple',
      model: 'MacBook Pro 14',
      processor: 'M3 Pro',
      ram: '16GB',
      storage: '512GB SSD',
    },
    isFeatured: true,
    tags: ['laptop', 'apple', 'macbook'],
    soldCount: 45,
    rating: { average: 4.7, count: 128 },
  },
  {
    name: 'Noise Cancelling Headphones',
    description: 'Wireless headphones with active noise cancellation.',
    shortDescription: '40-hour battery, premium sound',
    categoryName: 'Electronics',
    price: 15999,
    discountPrice: 12999,
    stock: 40,
    sku: 'ELEC-HDP-002',
    mainImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e'],
    specifications: {
      brand: 'Sony',
      connectivity: 'Bluetooth 5.3',
      battery: '40 hours',
    },
    isFeatured: true,
    tags: ['headphones', 'audio', 'wireless'],
    soldCount: 210,
    rating: { average: 4.5, count: 340 },
  },
  {
    name: 'Air Fryer XL',
    description: 'Healthy cooking with fast hot-air circulation.',
    shortDescription: '6L capacity with digital controls',
    categoryName: 'Home Appliances',
    price: 8999,
    stock: 22,
    sku: 'HOME-AFR-003',
    mainImage: 'https://images.unsplash.com/photo-1585515656426-e4d8f9e6e5d0',
    images: ['https://images.unsplash.com/photo-1585515656426-e4d8f9e6e5d0'],
    specifications: {
      brand: 'Philips',
      capacity: '6L',
      power: '1700W',
    },
    tags: ['kitchen', 'air-fryer', 'appliance'],
    soldCount: 88,
    rating: { average: 4.4, count: 76 },
  },
  {
    name: 'Everyday Oversized Tee',
    description: 'Soft cotton t-shirt for casual everyday wear.',
    shortDescription: 'Relaxed fit, breathable fabric',
    categoryName: 'Fashion',
    price: 1299,
    discountPrice: 999,
    stock: 75,
    sku: 'FSHN-TEE-004',
    mainImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
    images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab'],
    specifications: {
      material: '100% cotton',
      fit: 'Oversized',
    },
    tags: ['tshirt', 'fashion', 'casual'],
    soldCount: 150,
    rating: { average: 4.3, count: 98 },
  },
];

const seedDemoData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    const categoryMap = {};

    for (const categoryData of categories) {
      let category = await Category.findOne({ name: categoryData.name });

      if (!category) {
        category = new Category(categoryData);
      } else {
        Object.assign(category, categoryData);
      }

      await category.save();

      categoryMap[categoryData.name] = category._id;
    }

    for (const productData of products) {
      const { categoryName, ...rest } = productData;
      const categoryId = categoryMap[categoryName];

      let product = await Product.findOne({ sku: rest.sku });

      if (!product) {
        product = new Product({
          ...rest,
          category: categoryId,
        });
      } else {
        Object.assign(product, {
          ...rest,
          category: categoryId,
        });
      }

      await product.save();
    }

    console.log('Demo categories and products seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seed demo data error:', error.message);
    process.exit(1);
  }
};

seedDemoData();
