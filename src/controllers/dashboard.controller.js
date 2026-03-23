const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

const getRangeStart = (date, mode) => {
  const start = new Date(date);

  if (mode === 'day') {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return start;
};

const getRevenueForRange = async (start) => {
  const result = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start },
        status: { $ne: 'cancelled' },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$pricing.total' },
        totalOrders: { $sum: 1 },
      },
    },
  ]);

  return {
    orders: result[0]?.totalOrders || 0,
    revenue: result[0]?.totalRevenue || 0,
  };
};

const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = getRangeStart(now, 'day');
    const monthStart = getRangeStart(now, 'month');

    const [today, thisMonth, overview, recentOrders, orderStatusSummary] = await Promise.all([
      Promise.all([
        getRevenueForRange(todayStart),
        User.countDocuments({
          role: 'customer',
          createdAt: { $gte: todayStart },
        }),
      ]).then(([revenue, customers]) => ({
        orders: revenue.orders,
        revenue: revenue.revenue,
        customers,
      })),
      Promise.all([
        getRevenueForRange(monthStart),
        User.countDocuments({
          role: 'customer',
          createdAt: { $gte: monthStart },
        }),
      ]).then(([revenue, customers]) => ({
        orders: revenue.orders,
        revenue: revenue.revenue,
        customers,
      })),
      Promise.all([
        Product.countDocuments(),
        Product.countDocuments({ isActive: true }),
        Product.countDocuments({ stock: 0 }),
        User.countDocuments({ role: 'customer' }),
        Order.countDocuments(),
        Order.countDocuments({ 'payment.status': 'pending' }),
      ]).then(
        ([totalProducts, activeProducts, outOfStock, totalCustomers, totalOrders, pendingPayments]) => ({
          totalProducts,
          activeProducts,
          outOfStock,
          totalCustomers,
          totalOrders,
          pendingPayments,
        })
      ),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderNumber customer status pricing payment createdAt'),
      Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const ordersByStatus = orderStatusSummary.reduce((summary, item) => {
      summary[item._id] = item.count;
      return summary;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        today,
        thisMonth,
        overview,
        ordersByStatus,
        recentOrders,
      },
    });
  } catch (error) {
    console.error('Get Dashboard Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
};
