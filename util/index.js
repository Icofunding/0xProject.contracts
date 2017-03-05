const ethUtil = require('ethereumjs-util');
const { getOrderHash, getMsgHash } = require('./hashUtil.js');
const BNutil = require('./BNutil.js');

module.exports = web3 => {
  return {
    createOrder: params => {
      return new Promise((resolve, reject) => {
        params.orderHash = getOrderHash(params, { hex: true });
        let msgHash = getMsgHash(params, { hex: true, hashPersonal: true });
        web3.eth.sign(params.maker, msgHash, (err, sig) => {
          if (err) {
            reject(err);
          }
          let { v, r, s } = ethUtil.fromRpcSig(sig);
          let { maker, taker, feeRecipient, tokenM, tokenT, valueM, valueT, feeM, feeT, expiration, orderHash } = params;
          resolve({
            maker,
            taker,
            feeRecipient,
            tokenM,
            tokenT,
            valueM,
            valueT,
            feeM,
            feeT,
            orderHash,
            expiration,
            v,
            r: ethUtil.bufferToHex(r),
            s: ethUtil.bufferToHex(s)
          });
        });
      });
    },
    createFill: (order, fillValueM) => {
      return {
        traders: [order.maker, order.taker],
        feeRecipient: order.feeRecipient,
        tokens: [order.tokenM, order.tokenT],
        values: [order.valueM, order.valueT],
        fees: [order.feeM, order.feeT],
        expiration: order.expiration,
        fillValueM,
        v: order.v,
        rs: [order.r, order.s]
      };
    },
    createMultiFill: (orders, fillValuesM) => {
      let ret = {
        traders: [],
        feeRecipients: [],
        tokens: [],
        values: [],
        fees: [],
        expirations: [],
        fillValuesM: [],
        v: [],
        rs: []
      };
      orders.forEach((order, i) => {
        ret.traders.push([order.maker, order.taker]);
        ret.feeRecipients.push(order.feeRecipient),
        ret.tokens.push([order.tokenM, order.tokenT]),
        ret.values.push([order.valueM, order.valueT]),
        ret.fees.push([order.feeM, order.feeT]),
        ret.expirations.push(order.expiration),
        ret.fillValuesM.push(fillValuesM[i]),
        ret.v.push(order.v),
        ret.rs.push([order.r, order.s])
      });
      return ret;
    },
    createCancel: (order, cancelValueM) => {
      return {
        traders: [order.maker, order.taker],
        tokens: [order.tokenM, order.tokenT],
        values: [order.valueM, order.valueT],
        fees: [order.feeM, order.feeT],
        expiration: order.expiration,
        cancelValueM
      };
    },
    validSignature: (order, { hashPersonal = true } = {}) => {
      let msgHash = getMsgHash(order, { hashPersonal });
      let { v, r, s } = order;
      try {
        let pubKey = ethUtil.ecrecover(msgHash, v, ethUtil.toBuffer(r), ethUtil.toBuffer(s));
        return ethUtil.bufferToHex(ethUtil.pubToAddress(pubKey, true)) === order.maker;
      }
      catch(err) {
        return false;
      }
    },
    sha3: ethUtil.sha3,
    getOrderHash,
    getMsgHash,
    BNutil
  };
};
