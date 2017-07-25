import * as _ from 'lodash';
import ethUtil = require('ethereumjs-util');
import promisify = require('es6-promisify');
import Web3 = require('web3');
import { crypto } from './crypto';
import { OrderParams } from './types';
import * as BigNumber from 'bignumber.js';

// In order to benefit from type-safety, we re-assign the global web3 instance injected by Truffle
// with type `any` to a variable of type `Web3`.
const web3Instance: Web3 = web3;

export class Order {
  public params: OrderParams;
  constructor(params: OrderParams) {
    this.params = params;
  }
  public isValidSignature() {
    const { v, r, s } = this.params;
    if (_.isUndefined(v) || _.isUndefined(r) || _.isUndefined(s)) {
      throw new Error('Cannot call isValidSignature on unsigned order');
    }
    const orderHash = this.getOrderHash();
    const msgHash = ethUtil.hashPersonalMessage(orderHash);
    try {
      const pubKey = ethUtil.ecrecover(msgHash, v, ethUtil.toBuffer(r), ethUtil.toBuffer(s));
      const recoveredAddress = ethUtil.bufferToHex(ethUtil.pubToAddress(pubKey));
      return recoveredAddress === this.params.maker;
    } catch (err) {
      return false;
    }
  }
  public async signAsync() {
    const orderHash = this.getOrderHash();
    const signature = await promisify(web3Instance.eth.sign)(this.params.maker, ethUtil.bufferToHex(orderHash));
    const { v, r, s } = ethUtil.fromRpcSig(signature);
    this.params = _.assign(this.params, {
      orderHashHex: ethUtil.bufferToHex(orderHash),
      v,
      r: ethUtil.bufferToHex(r),
      s: ethUtil.bufferToHex(s),
    });
  }
  public createFill(shouldThrowOnInsufficientBalanceOrAllowance?: boolean, fillTakerTokenAmount?: BigNumber.BigNumber) {
    const fill = {
      orderAddresses: [
        this.params.maker,
        this.params.taker,
        this.params.makerToken,
        this.params.takerToken,
        this.params.feeRecipient,
      ],
      orderValues: [
        this.params.makerTokenAmount,
        this.params.takerTokenAmount,
        this.params.makerFee,
        this.params.takerFee,
        this.params.expirationTimestampInSec,
        this.params.salt,
      ],
      fillTakerTokenAmount: fillTakerTokenAmount || this.params.takerTokenAmount,
      shouldThrowOnInsufficientBalanceOrAllowance: !!shouldThrowOnInsufficientBalanceOrAllowance,
      v: this.params.v,
      r: this.params.r,
      s: this.params.s,
    };
    return fill;
  }
  public createCancel(cancelTakerTokenAmount?: BigNumber.BigNumber) {
    const cancel = {
      orderAddresses: [
        this.params.maker,
        this.params.taker,
        this.params.makerToken,
        this.params.takerToken,
        this.params.feeRecipient,
      ],
      orderValues: [
        this.params.makerTokenAmount,
        this.params.takerTokenAmount,
        this.params.makerFee,
        this.params.takerFee,
        this.params.expirationTimestampInSec,
        this.params.salt,
      ],
      cancelTakerTokenAmount: cancelTakerTokenAmount || this.params.takerTokenAmount,
    };
    return cancel;
  }
  private getOrderHash() {
    const orderHash = crypto.solSHA3([
      this.params.exchangeContractAddress,
      this.params.maker,
      this.params.taker,
      this.params.makerToken,
      this.params.takerToken,
      this.params.feeRecipient,
      this.params.makerTokenAmount,
      this.params.takerTokenAmount,
      this.params.makerFee,
      this.params.takerFee,
      this.params.expirationTimestampInSec,
      this.params.salt,
    ]);
    return orderHash;
  }
}
