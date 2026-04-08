const crypto = require('crypto');

const pad = (value) => value.toString().padStart(2, '0');

const getDateSegment = (date = new Date()) => {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
};

const getTimeSegment = (date = new Date()) => {
  return `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const getRandomSegment = () => {
  return crypto.randomInt(1000, 10000).toString();
};

const generateOrderNumber = (date = new Date()) => {
  const dateSegment = `${pad(date.getDate())}${pad(date.getMonth() + 1)}`;
  return `ORD-${dateSegment}-${getRandomSegment()}`;
};

const generateInvoiceNumber = (date = new Date()) => {
  const dateSegment = `${date.getFullYear().toString().slice(-2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `INV-${dateSegment}-${getRandomSegment()}`;
};

module.exports = {
  generateOrderNumber,
  generateInvoiceNumber,
};
