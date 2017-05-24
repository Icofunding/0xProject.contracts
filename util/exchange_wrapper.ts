import { formatters } from './formatters';
import { Order } from './order';
import { ContractInstance } from './types';
import * as BigNumber from 'bignumber.js';

export class ExchangeWrapper {
  private exchange: ContractInstance;
  constructor(exchangeContractInstance: ContractInstance) {
    this.exchange = exchangeContractInstance;
  }
  public fillAsync(order: Order, from: string,
                   opts: { fillValueT?: BigNumber.BigNumber, shouldCheckTransfer?: boolean } = {}) {
    const shouldCheckTransfer = !!opts.shouldCheckTransfer;
    const params = order.createFill(shouldCheckTransfer, opts.fillValueT);
    return this.exchange.fill(
      params.orderAddresses,
      params.orderValues,
      params.fillValueT,
      params.shouldCheckTransfer,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public cancelAsync(order: Order, from: string, opts: { cancelValueT?: BigNumber.BigNumber } = {}) {
    const params = order.createCancel(opts.cancelValueT);
    return this.exchange.cancel(
      params.orderAddresses,
      params.orderValues,
      params.cancelValueT,
      { from },
    );
  }
  public fillOrKillAsync(order: Order, from: string, opts: { fillValueT?: BigNumber.BigNumber } = {}) {
    const shouldCheckTransfer = false;
    const params = order.createFill(shouldCheckTransfer, opts.fillValueT);
    return this.exchange.fillOrKill(
      params.orderAddresses,
      params.orderValues,
      params.fillValueT,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public batchFillAsync(orders: Order[], from: string,
                        opts: { fillValuesT?: BigNumber.BigNumber[], shouldCheckTransfer?: boolean } = {}) {
    const shouldCheckTransfer = !!opts.shouldCheckTransfer;
    const params = formatters.createBatchFill(orders, shouldCheckTransfer, opts.fillValuesT);
    return this.exchange.batchFill(
      params.orderAddresses,
      params.orderValues,
      params.fillValuesT,
      params.shouldCheckTransfer,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public fillUpToAsync(orders: Order[], from: string,
                       opts: { fillValueT?: BigNumber.BigNumber, shouldCheckTransfer?: boolean } = {}) {
    const shouldCheckTransfer = !!opts.shouldCheckTransfer;
    const params = formatters.createFillUpTo(orders, shouldCheckTransfer, opts.fillValueT);
    return this.exchange.fillUpTo(
      params.orderAddresses,
      params.orderValues,
      params.fillValueT,
      params.shouldCheckTransfer,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public batchCancelAsync(orders: Order[], from: string, opts: { cancelValuesT?: BigNumber.BigNumber[] } = {}) {
    const params = formatters.createBatchCancel(orders, opts.cancelValuesT);
    return this.exchange.batchCancel(
      params.orderAddresses,
      params.orderValues,
      params.cancelValuesT,
      { from },
    );
  }
  public getOrderHashAsync(order: Order) {
    const shouldCheckTransfer = false;
    const params = order.createFill(shouldCheckTransfer);
    return this.exchange.getOrderHash(params.orderAddresses, params.orderValues);
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
