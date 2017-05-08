import { formatters } from './formatters';
import { Order } from './order';
import { ContractInstance } from './types';
import BigNumber = require('bignumber.js');

export class ExchangeWrapper {
  private exchange: ContractInstance;
  constructor(exchangeContractInstance: ContractInstance) {
    this.exchange = exchangeContractInstance;
  }
  public fillAsync(order: Order, from: string,
                   opts: { fillValueT?: BigNumber, shouldCheckTransfer?: boolean } = {}) {
    const shouldCheckTransfer = !!opts.shouldCheckTransfer;
    const params = order.createFill(shouldCheckTransfer, opts.fillValueT);
    return this.exchange.fill(
      params.traders,
      params.tokens,
      params.feeRecipient,
      params.shouldCheckTransfer,
      params.values,
      params.fees,
      params.expirationAndSalt,
      params.fillValueT,
      params.v,
      params.rs,
      { from },
    );
  }
  public cancelAsync(order: Order, from: string, opts: { cancelValueT?: BigNumber } = {}) {
    const params = order.createCancel(opts.cancelValueT);
    return this.exchange.cancel(
      params.traders,
      params.tokens,
      params.feeRecipient,
      params.values,
      params.fees,
      params.expirationAndSalt,
      params.cancelValueT,
      { from },
    );
  }
  public fillOrKillAsync(order: Order, from: string, opts: { fillValueT?: BigNumber } = {}) {
    const shouldCheckTransfer = false;
    const params = order.createFill(shouldCheckTransfer, opts.fillValueT);
    return this.exchange.fillOrKill(
      params.traders,
      params.tokens,
      params.feeRecipient,
      params.values,
      params.fees,
      params.expirationAndSalt,
      params.fillValueT,
      params.v,
      params.rs,
      { from },
    );
  }
  public batchFillAsync(orders: Order[], from: string, opts: { fillValuesT?: BigNumber[] } = {}) {
    const shouldCheckTransfer = false;
    const params = formatters.createBatchFill(orders, shouldCheckTransfer, opts.fillValuesT);
    return this.exchange.batchFill(
      params.traders,
      params.tokens,
      params.feeRecipients,
      params.shouldCheckTransfer,
      params.values,
      params.fees,
      params.expirationsAndSalts,
      params.fillValuesT,
      params.v,
      params.rs,
      { from },
    );
  }
  public fillUpToAsync(orders: Order[], from: string, opts: { fillValueT?: BigNumber } = {}) {
    const shouldCheckTransfer = false;
    const params = formatters.createFillUpTo(orders, shouldCheckTransfer, opts.fillValueT);
    return this.exchange.fillUpTo(
      params.traders,
      params.tokens,
      params.feeRecipients,
      params.shouldCheckTransfer,
      params.values,
      params.fees,
      params.expirationsAndSalts,
      params.fillValueT,
      params.v,
      params.rs,
      { from },
    );
  }
  public batchCancelAsync(orders: Order[], from: string, opts: { cancelValuesT?: BigNumber[] } = {}) {
    const params = formatters.createBatchCancel(orders, opts.cancelValuesT);
    return this.exchange.batchCancel(
      params.traders,
      params.tokens,
      params.feeRecipients,
      params.values,
      params.fees,
      params.expirationsAndSalts,
      params.cancelValuesT,
      { from },
    );
  }
  public getOrderHashAsync(order: Order) {
    const shouldCheckTransfer = false;
    const params = order.createFill(shouldCheckTransfer);
    return this.exchange.getOrderHash(
      params.traders,
      params.tokens,
      params.feeRecipient,
      params.values,
      params.fees,
      params.expirationAndSalt,
    );
  }
  public isValidSignatureAsync(order: Order) {
    const isValidSignature = this.exchange.isValidSignature(
      order.params.maker,
      order.params.orderHashHex,
      order.params.v,
      order.params.r,
      order.params.s,
    );
    return isValidSignature;
  }
}
