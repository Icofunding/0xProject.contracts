import * as _ from 'lodash';
import { BatchFill, BatchCancel, FillUpTo } from './types';
import { Order } from './order';

export const formatters = {
  createBatchFill(orders: Order[], shouldCheckTransfer: boolean, fillValuesT: string[] = []) {
    const batchFill: BatchFill = {
      traders: [],
      tokens: [],
      feeRecipients: [],
      shouldCheckTransfer,
      values: [],
      fees: [],
      expirations: [],
      fillValuesT,
      v: [],
      rs: [],
    };
    _.forEach(orders, order => {
      batchFill.traders.push([order.params.maker, order.params.taker]);
      batchFill.tokens.push([order.params.tokenM, order.params.tokenT]);
      batchFill.feeRecipients.push(order.params.feeRecipient);
      batchFill.values.push([order.params.valueM, order.params.valueT]);
      batchFill.fees.push([order.params.feeM, order.params.feeT]);
      batchFill.expirations.push(order.params.expiration);
      batchFill.v.push(order.params.v);
      batchFill.rs.push([order.params.r, order.params.s]);
      if (fillValuesT.length < orders.length) {
        batchFill.fillValuesT.push(order.params.valueT);
      }
    });
    return batchFill;
  },
  createFillUpTo(orders: Order[], shouldCheckTransfer: boolean, fillValueT: string) {
    const fillUpTo: FillUpTo = {
      traders: [],
      tokens: [],
      feeRecipients: [],
      shouldCheckTransfer,
      values: [],
      fees: [],
      expirations: [],
      fillValueT,
      v: [],
      rs: [],
    };
    orders.forEach(order => {
      fillUpTo.traders.push([order.params.maker, order.params.taker]);
      fillUpTo.tokens.push([order.params.tokenM, order.params.tokenT]);
      fillUpTo.feeRecipients.push(order.params.feeRecipient);
      fillUpTo.values.push([order.params.valueM, order.params.valueT]);
      fillUpTo.fees.push([order.params.feeM, order.params.feeT]);
      fillUpTo.expirations.push(order.params.expiration);
      fillUpTo.v.push(order.params.v);
      fillUpTo.rs.push([order.params.r, order.params.s]);
    });
    return fillUpTo;
  },
  createBatchCancel(orders: Order[], cancelValuesT: string[] = []) {
    const batchCancel: BatchCancel = {
      traders: [],
      tokens: [],
      feeRecipients: [],
      values: [],
      fees: [],
      expirations: [],
      cancelValuesT,
    };
    orders.forEach(order => {
      batchCancel.traders.push([order.params.maker, order.params.taker]);
      batchCancel.tokens.push([order.params.tokenM, order.params.tokenT]);
      batchCancel.feeRecipients.push(order.params.feeRecipient);
      batchCancel.values.push([order.params.valueM, order.params.valueT]);
      batchCancel.fees.push([order.params.feeM, order.params.feeT]);
      batchCancel.expirations.push(order.params.expiration);
      if (cancelValuesT.length < orders.length) {
        batchCancel.cancelValuesT.push(order.params.valueT);
      }
    });
    return batchCancel;
  },
};
