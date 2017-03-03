const BN = require('bn.js');

exports.add = (numA, numB, { s = true, n = false } = {}) => {
  let a = new BN(numA);
  let b = new BN(numB);
  let ret = a.add(b).toString();
  return s ? ret.toString() : n ? ret.toNumber() : ret;
};

exports.sub = (numA, numB, { s = true, n = false } = {}) => {
  let a = new BN(numA);
  let b = new BN(numB);
  let ret = a.sub(b);
  return s ? ret.toString() : n ? ret.toNumber() : ret;
};

exports.mul = (numA, numB, { s = true, n = false } = {}) => {
  let a = new BN(numA);
  let b = new BN(numB);
  let ret = a.mul(b);
  return s ? ret.toString() : n ? ret.toNumber() : ret;
};

exports.div = (numA, numB, { s = true, n = false } = {}) => {
  let a = new BN(numA);
  let b = new BN(numB);
  let ret = a.div(b);
  return s ? ret.toString() : n ? ret.toNumber() : ret;
};

exports.compare = (numA, numB) => {
  let diff = exports.sub(numA, numB, { n: true });
  return diff > 0 ? 1 : diff === 0 ? 0 : -1;
};

exports.toBuffer = (num, { size = 32, endian = 'be' } = {}) => {
  return new BN(num).toArrayLike(Buffer, endian, size);
};

exports.toSmallestUnits = (num, { s = true, n = false, decimals = 18 } = {}) => {
  let a = new BN(num);
  let unit = new BN(10).pow(decimals);
  return exports.mul(a, unit, { s, n });
};

exports.toLargestUnits = (num, { s = true, n = false, decimals = 18 } = {}) => {
  let a = new BN(num);
  let unit = new BN(10).pow(decimals);
  return exports.div(num, unit, { s, n });
};
