const crypto = require('crypto');

const pad = (value) => value.toString().padStart(2, '0');

const getDateSegment = (date = new Date()) => {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
};

const getTimeSegment = (date = new Date()) => {
  return `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const getRandomSegment = () => {
  return crypto.randomInt(100, 1000).toString();
};

const generateOrderNumber = (date = new Date()) => {
  return `ORD-${getDateSegment(date)}-${getTimeSegment(date)}-${getRandomSegment()}`;
};

const generateInvoiceNumber = (date = new Date()) => {
  return `INV-${getDateSegment(date)}-${getTimeSegment(date)}-${getRandomSegment()}`;
};

module.exports = {
  generateOrderNumber,
  generateInvoiceNumber,
};
