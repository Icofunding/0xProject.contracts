const BN = require('bn.js');

exports.add = (numA, numB, { s = true, n = false } = {}) => {
  let a = new BN(numA);
  let b = new BN(numB);
  let ret = a.add(b).toString();
  return s && !n ? ret.toString() : n ? ret.toNumber() : ret;
};

exports.sub = (numA, numB, { s = true, n = false } = {}) => {
  let a = new BN(numA);
  let b = new BN(numB);
  let ret = a.sub(b);
  return s && !n ? ret.toString() : n ? ret.toNumber() : ret;
};

exports.mul = (numA, numB, { s = true, n = false } = {}) => {
  let a = new BN(numA);
  let b = new BN(numB);
  let ret = a.mul(b);
  return s && !n ? ret.toString() : n ? ret.toNumber() : ret;
};

exports.div = (numA, numB, { s = true, n = false } = {}) => {
  let a = new BN(numA);
  let b = new BN(numB);
  let ret = a.div(b);
  return s && !n ? ret.toString() : n ? ret.toNumber() : ret;
};

exports.cmp = (numA, numB) => {
  let a = new BN(numA);
  let b = new BN(numB);
  return a.cmp(b);
};

exports.toBuffer = (num, { size = 32, endian = 'be' } = {}) => {
  return new BN(num).toArrayLike(Buffer, endian, size);
};

exports.toSmallestUnits = (num, { s = true, n = false, decimals = 18 } = {}) => {
  let a = new BN(num);
  let unit = new BN(10).pow(new BN(decimals));
  let ret = a.mul(unit);
  return s && !n ? ret.toString() : n ? ret.toNumber() : ret;
};

exports.toLargestUnits = (num, { s = true, n = false, decimals = 18 } = {}) => {
  let a = new BN(num);
  let unit = new BN(10).pow(new BN(decimals));
  let ret = a.div(unit);
  return s && !n ? ret.toString() : n ? ret.toNumber() : ret;
};
