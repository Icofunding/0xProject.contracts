import * as _ from 'lodash';
import ethUtil = require('ethereumjs-util');
import promisify = require('es6-promisify');
import Web3 = require('web3');
import {ZeroEx, ECSignature, Order as ZeroExOrder} from '0x.js';
import {OrderParams} from './types';
import * as BigNumber from 'bignumber.js';

// In order to benefit from type-safety, we re-assign the global web3 instance injected by Truffle
// with type `any` to a variable of type `Web3`.
const web3: Web3 = (global as any).web3;

export class Order {
  public params: OrderParams;
  public zeroEx: ZeroEx;
  constructor(params: OrderParams) {
    this.zeroEx = new ZeroEx(web3.currentProvider);
    this.params = params;
  }
  public isValidSignature() {
    const {v, r, s} = this.params;
    if (_.isUndefined(v) || _.isUndefined(r) || _.isUndefined(s)) {
      throw new Error('Cannot call isValidSignature on unsigned order');
    }
    const orderHash = this.getOrderHash();
    const isValidSignature = ZeroEx.isValidSignature(orderHash, this.params as any as ECSignature, this.params.maker);
    return isValidSignature;
  }
  public async signAsync() {
    const orderHash = this.getOrderHash();
    const signature = await this.zeroEx.signOrderHashAsync(orderHash, this.params.maker);
    this.params = _.assign(this.params, {
      orderHashHex: orderHash,
      ...signature,
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
  private getOrderHash(): string {
    const order: ZeroExOrder = {
        exchangeContractAddress: this.params.exchangeContractAddress,
        maker: this.params.maker,
        taker: this.params.taker,
        makerTokenAddress: this.params.makerToken,
        takerTokenAddress: this.params.takerToken,
        feeRecipient: this.params.feeRecipient,
        makerTokenAmount: this.params.makerTokenAmount,
        takerTokenAmount: this.params.takerTokenAmount,
        makerFee: this.params.makerFee,
        takerFee: this.params.takerFee,
        expirationUnixTimestampSec: this.params.expirationTimestampInSec,
        salt: this.params.salt,
    };
    const orderHash = ZeroEx.getOrderHashHex(order);
    return orderHash;
  }
}
