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
                        opts: {
                            fillTakerTokenAmount?: BigNumber.BigNumber,
                            shouldThrowOnInsufficientBalanceOrAllowance?: boolean,
                        } = {}) {
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
    const params = formatters.createBatchFill(
        orders, shouldThrowOnInsufficientBalanceOrAllowance, opts.fillTakerTokenAmounts);
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
                                    opts: {
                                        fillTakerTokenAmounts?: BigNumber.BigNumber[],
                                    } = {}) {
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
  public batchCancelOrdersAsync(orders: Order[], from: string,
                                opts: {cancelTakerTokenAmounts?: BigNumber.BigNumber[]} = {}) {
    const params = formatters.createBatchCancel(orders, opts.cancelTakerTokenAmounts);
    return this.exchange.batchCancelOrders(
      params.orderAddresses,
      params.orderValues,
      params.cancelTakerTokenAmounts,
      { from },
    );
  }
  public async getOrderHashAsync(order: Order): Promise<string> {
    const shouldThrowOnInsufficientBalanceOrAllowance = false;
    const params = order.createFill(shouldThrowOnInsufficientBalanceOrAllowance);
    const orderHash = await this.exchange.getOrderHash(params.orderAddresses, params.orderValues);
    return orderHash;
  }
  public async isValidSignatureAsync(order: Order): Promise<boolean> {
    const isValidSignature = await this.exchange.isValidSignature(
      order.params.maker,
      order.params.orderHashHex,
      order.params.v,
      order.params.r,
      order.params.s,
    );
    return isValidSignature;
  }
  public async isRoundingErrorAsync(numerator: BigNumber.BigNumber, denominator: BigNumber.BigNumber,
                                    target: BigNumber.BigNumber): Promise<boolean> {
    const isRoundingError = await this.exchange.isRoundingError(numerator, denominator, target);
    return isRoundingError;
  }
  public async getPartialAmountAsync(numerator: BigNumber.BigNumber, denominator: BigNumber.BigNumber,
                                     target: BigNumber.BigNumber): Promise<BigNumber.BigNumber> {
    const partialAmount = new BigNumber(await this.exchange.getPartialAmount(numerator, denominator, target));
    return partialAmount;
  }
}
