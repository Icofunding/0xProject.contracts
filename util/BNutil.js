const BN = require('bn.js');
const BigNumber = require('bignumber.js');

exports.add = (numA, numB, { s = true } = {}) => {
  const a = new BigNumber(numA);
  const b = new BigNumber(numB);
  const ret = a.plus(b);
  return s ? ret.toString() : ret;
};

exports.sub = (numA, numB, { s = true } = {}) => {
  const a = new BigNumber(numA);
  const b = new BigNumber(numB);
  const ret = a.minus(b);
  return s ? ret.toString() : ret;
};

exports.mul = (numA, numB, { s = true } = {}) => {
  const a = new BigNumber(numA);
  const b = new BigNumber(numB);
  const ret = a.times(b);
  return s ? ret.toString() : ret;
};

exports.div = (numA, numB, { s = true, DECIMAL_PLACES = 18 } = {}) => {
  BigNumber.config({ DECIMAL_PLACES });
  const a = new BigNumber(numA);
  const b = new BigNumber(numB);
  const ret = a.dividedBy(b);
  return s ? ret.toString() : ret;
};

exports.cmp = (numA, numB) => {
  const a = new BigNumber(numA);
  const b = new BigNumber(numB);
  return a.comparedTo(b);
};

exports.toBuffer = (num, { size = 32, endian = 'be' } = {}) =>
    new BN(num.toString()).toArrayLike(Buffer, endian, size);

exports.toSmallestUnits = (num, { s = true, decimals = 18 } = {}) => {
  const a = new BigNumber(num);
  const unit = new BigNumber(10).pow(decimals);
  const ret = a.times(unit);
  return s ? ret.toString() : ret;
};

exports.toLargestUnits = (num, { s = true, decimals = 18, DECIMAL_PLACES = 18 } = {}) => {
  BigNumber.config({ DECIMAL_PLACES });
  const a = new BigNumber(num);
  const unit = new BigNumber(10).pow(decimals);
  const ret = a.dividedBy(unit);
  return s ? ret.toString() : ret;
};

exports.setDecimals = (num, { s = true, DECIMAL_PLACES = 18 }) => {
  BigNumber.config({ DECIMAL_PLACES });
  const ret = new BigNumber(num).dividedBy(1);
  return s ? ret.toString() : ret;
};
