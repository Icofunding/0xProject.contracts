import { formatters } from './formatters';
import { Order } from './order';
import { ContractInstance } from './types';
import * as BigNumber from 'bignumber.js';

export class ExchangeWrapper {
  private exchange: ContractInstance;
  constructor(exchangeContractInstance: ContractInstance) {
    this.exchange = exchangeContractInstance;
  }
  public fillOrderAsync(order: Order, from: string,
                   opts: { fillTakerTokenAmount?: BigNumber.BigNumber,
                           shouldThrowOnInsufficientBalanceOrAllowance?: boolean } = {}) {
    const shouldThrowOnInsufficientBalanceOrAllowance = !!opts.shouldThrowOnInsufficientBalanceOrAllowance;
    const params = order.createFill(shouldThrowOnInsufficientBalanceOrAllowance, opts.fillTakerTokenAmount);
    return this.exchange.fillOrder(
      params.orderAddresses,
      params.orderValues,
      params.fillTakerTokenAmount,
      params.shouldThrowOnInsufficientBalanceOrAllowance,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public cancelOrderAsync(order: Order, from: string, opts: { cancelTakerTokenAmount?: BigNumber.BigNumber } = {}) {
    const params = order.createCancel(opts.cancelTakerTokenAmount);
    return this.exchange.cancelOrder(
      params.orderAddresses,
      params.orderValues,
      params.cancelTakerTokenAmount,
      { from },
    );
  }
  public fillOrKillOrderAsync(order: Order, from: string, opts: { fillTakerTokenAmount?: BigNumber.BigNumber } = {}) {
    const shouldThrowOnInsufficientBalanceOrAllowance = true;
    const params = order.createFill(shouldThrowOnInsufficientBalanceOrAllowance, opts.fillTakerTokenAmount);
    return this.exchange.fillOrKillOrder(
      params.orderAddresses,
      params.orderValues,
      params.fillTakerTokenAmount,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public batchFillOrdersAsync(orders: Order[], from: string,
                              opts: { fillTakerTokenAmounts?: BigNumber.BigNumber[],
                                      shouldThrowOnInsufficientBalanceOrAllowance?: boolean } = {}) {
    const shouldThrowOnInsufficientBalanceOrAllowance = !!opts.shouldThrowOnInsufficientBalanceOrAllowance;
    const params = formatters.createBatchFill(orders, shouldThrowOnInsufficientBalanceOrAllowance, opts.fillTakerTokenAmounts);
    return this.exchange.batchFillOrders(
      params.orderAddresses,
      params.orderValues,
      params.fillTakerTokenAmounts,
      params.shouldThrowOnInsufficientBalanceOrAllowance,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public batchFillOrKillOrdersAsync(orders: Order[], from: string,
                              opts: { fillTakerTokenAmounts?: BigNumber.BigNumber[] } = {}) {
    const params = formatters.createBatchFill(orders, undefined, opts.fillTakerTokenAmounts);
    return this.exchange.batchFillOrKillOrders(
      params.orderAddresses,
      params.orderValues,
      params.fillTakerTokenAmounts,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public fillOrdersUpToAsync(orders: Order[], from: string,
                             opts: { fillTakerTokenAmount?: BigNumber.BigNumber,
                                     shouldThrowOnInsufficientBalanceOrAllowance?: boolean } = {}) {
    const shouldThrowOnInsufficientBalanceOrAllowance = !!opts.shouldThrowOnInsufficientBalanceOrAllowance;
    const params = formatters.createFillUpTo(orders,
                                             shouldThrowOnInsufficientBalanceOrAllowance,
                                             opts.fillTakerTokenAmount);
    return this.exchange.fillOrdersUpTo(
      params.orderAddresses,
      params.orderValues,
      params.fillTakerTokenAmount,
      params.shouldThrowOnInsufficientBalanceOrAllowance,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public batchCancelOrdersAsync(orders: Order[], from: string, opts: { cancelTakerTokenAmounts?: BigNumber.BigNumber[] } = {}) {
    const params = formatters.createBatchCancel(orders, opts.cancelTakerTokenAmounts);
    return this.exchange.batchCancelOrders(
      params.orderAddresses,
      params.orderValues,
      params.cancelTakerTokenAmounts,
      { from },
    );
  }
  public getOrderHashAsync(order: Order) {
    const shouldThrowOnInsufficientBalanceOrAllowance = false;
    const params = order.createFill(shouldThrowOnInsufficientBalanceOrAllowance);
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
  public isRoundingErrorAsync(numerator: BigNumber.BigNumber, denominator: BigNumber.BigNumber, target: BigNumber.BigNumber) {
    const isRoundingError = this.exchange.isRoundingError(numerator, denominator, target);
    return isRoundingError;
  }
  public getPartialAmountAsync(numerator: BigNumber.BigNumber, denominator: BigNumber.BigNumber, target: BigNumber.BigNumber) {
    const partialAmount = this.exchange.getPartialAmount(numerator, denominator, target);
    return partialAmount;
  }
}
