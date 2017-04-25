import { formatters } from './formatters';
import { Order } from './order';
import { ContractInstance } from './types';

export class ExchangeWrapper {
  private exchange: ContractInstance;
  constructor(exchangeContractInstance: ContractInstance) {
    this.exchange = exchangeContractInstance;
  }
  public fillAsync(order: Order, from: string,
                   opts: { fillValueM?: string, shouldCheckTransfer?: boolean } = {}) {
    const shouldCheckTransfer = !!opts.shouldCheckTransfer;
    const params = order.createFill(shouldCheckTransfer, opts.fillValueM);
    return this.exchange.fill(
      params.traders,
      params.tokens,
      params.feeRecipient,
      params.shouldCheckTransfer,
      params.values,
      params.fees,
      params.expiration,
      params.fillValueM,
      params.v,
      params.rs,
      { from },
    );
  }
  public cancelAsync(order: Order, from: string, opts: { cancelValueM?: string } = {}) {
    const params = order.createCancel(opts.cancelValueM);
    return this.exchange.cancel(
      params.traders,
      params.tokens,
      params.feeRecipient,
      params.values,
      params.fees,
      params.expiration,
      params.cancelValueM,
      { from },
    );
  }
  public fillOrKillAsync(order: Order, from: string, opts: { fillValueM?: string } = {}) {
    const shouldCheckTransfer = false;
    const params = order.createFill(shouldCheckTransfer, opts.fillValueM);
    return this.exchange.fillOrKill(
      params.traders,
      params.tokens,
      params.feeRecipient,
      params.values,
      params.fees,
      params.expiration,
      params.fillValueM,
      params.v,
      params.rs,
      { from },
    );
  }
  public batchFillAsync(orders: Order[], from: string, opts: { fillValuesM?: string[] } = {}) {
    const shouldCheckTransfer = false;
    const params = formatters.createBatchFill(orders, shouldCheckTransfer, opts.fillValuesM);
    return this.exchange.batchFill(
      params.traders,
      params.tokens,
      params.feeRecipients,
      params.shouldCheckTransfer,
      params.values,
      params.fees,
      params.expirations,
      params.fillValuesM,
      params.v,
      params.rs,
      { from },
    );
  }
  public fillUpToAsync(orders: Order[], from: string, opts: { fillValueM?: string } = {}) {
    const shouldCheckTransfer = false;
    const params = formatters.createFillUpTo(orders, shouldCheckTransfer, opts.fillValueM);
    return this.exchange.fillUpTo(
      params.traders,
      params.tokens,
      params.feeRecipients,
      params.shouldCheckTransfer,
      params.values,
      params.fees,
      params.expirations,
      params.fillValueM,
      params.v,
      params.rs,
      { from },
    );
  }
  public batchCancelAsync(orders: Order[], from: string, opts: { cancelValuesM?: string[] } = {}) {
    const params = formatters.createBatchCancel(orders, opts.cancelValuesM);
    return this.exchange.batchCancel(
      params.traders,
      params.tokens,
      params.feeRecipients,
      params.values,
      params.fees,
      params.expirations,
      params.cancelValuesM,
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
      params.expiration,
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
