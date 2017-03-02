const ethUtil = require('ethereumjs-util');

const getOrderHash = (params) => {
  return ethUtil.sha3(Buffer.concat([
    ethUtil.toBuffer(params.exchange),
    ethUtil.toBuffer(params.maker),
    ethUtil.toBuffer(params.tokenM),
    ethUtil.toBuffer(params.tokenT),
    ethUtil.toBuffer(params.valueM),
    ethUtil.toBuffer(params.valueT),
    ethUtil.toBuffer(params.expiration)
  ]));
};

const getMsgHash = (params, hashPersonal = true) => {
  let msgHash = ethUtil.sha3(Buffer.concat([
    ethUtil.toBuffer(params.orderHash),
    ethUtil.toBuffer(params.feeRecipient),
    ethUtil.toBuffer(params.feeM),
    ethUtil.toBuffer(params.feeT)
  ]));

  if (hashPersonal) { msgHash = ethUtil.hashPersonalMessage(msgHash); }

  return msgHash;
};

const pubFromOrderSig = (order) => {
  let msgHash = getMsgHash(order);
  let { v, r, s } = order;
  let pubKey = ethUtil.ecrecover(msgHash, v, ethUtil.toBuffer(r), ethUtil.toBuffer(s));
  let address = ethUtil.bufferToHex(ethUtil.pubToAddress(pubKey, true));
  return address;
};

module.exports = (web3) => {
  return {
    createOrder: (params) => {
      return new Promise((resolve, reject) => {
        params.orderHash = ethUtil.bufferToHex(getOrderHash(params));
        let msgHash = getMsgHash(params);

        web3.eth.sign(params.maker, ethUtil.bufferToHex(msgHash), (err, sig) => {
          if (err) {
            reject(err);
          }

          let { v, r, s } = ethUtil.fromRpcSig(sig);
          let { maker, feeRecipient, tokenM, tokenT, valueM, valueT, feeM, feeT, expiration, orderHash } = params;

          resolve({
            maker,
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
    pubFromOrderSig
  }
};
