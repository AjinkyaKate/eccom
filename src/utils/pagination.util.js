const parsePagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
};

const buildPaginationMeta = ({ page, limit, totalItems }) => {
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;

  return {
    currentPage: page,
    totalPages,
    totalItems,
    totalProducts: totalItems, // backwards compat
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    hasMore: page * limit < totalItems,
  };
};

module.exports = {
  parsePagination,
  buildPaginationMeta,
};
