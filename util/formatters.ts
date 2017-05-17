import * as _ from 'lodash';
import { BatchFill, BatchCancel, FillUpTo } from './types';
import { Order } from './order';
import BigNumber = require('bignumber.js');

export const formatters = {
  createBatchFill(orders: Order[], shouldCheckTransfer: boolean, fillValuesT: BigNumber[] = []) {
    const batchFill: BatchFill = {
      orderAddresses: [],
      orderValues: [],
      fillValuesT,
      shouldCheckTransfer,
      v: [],
      r: [],
      s: [],
    };
    _.forEach(orders, order => {
      batchFill.orderAddresses.push([order.params.maker, order.params.taker, order.params.tokenM,
                                     order.params.tokenT, order.params.feeRecipient]);
      batchFill.orderValues.push([order.params.valueM, order.params.valueT, order.params.feeM,
                                  order.params.feeT, order.params.expiration, order.params.salt]);
      batchFill.v.push(order.params.v);
      batchFill.r.push(order.params.r);
      batchFill.s.push(order.params.s);
      if (fillValuesT.length < orders.length) {
        batchFill.fillValuesT.push(order.params.valueT);
      }
    });
    return batchFill;
  },
  createFillUpTo(orders: Order[], shouldCheckTransfer: boolean, fillValueT: BigNumber) {
    const fillUpTo: FillUpTo = {
      orderAddresses: [],
      orderValues: [],
      fillValueT,
      shouldCheckTransfer,
      v: [],
      r: [],
      s: [],
    };
    orders.forEach(order => {
      fillUpTo.orderAddresses.push([order.params.maker, order.params.taker, order.params.tokenM,
                                    order.params.tokenT, order.params.feeRecipient]);
      fillUpTo.orderValues.push([order.params.valueM, order.params.valueT, order.params.feeM,
                                 order.params.feeT, order.params.expiration, order.params.salt]);
      fillUpTo.v.push(order.params.v);
      fillUpTo.r.push(order.params.r);
      fillUpTo.s.push(order.params.s);
    });
    return fillUpTo;
  },
  createBatchCancel(orders: Order[], cancelValuesT: BigNumber[] = []) {
    const batchCancel: BatchCancel = {
      orderAddresses: [],
      orderValues: [],
      cancelValuesT,
    };
    orders.forEach(order => {
      batchCancel.orderAddresses.push([order.params.maker, order.params.taker, order.params.tokenM,
                                       order.params.tokenT, order.params.feeRecipient]);
      batchCancel.orderValues.push([order.params.valueM, order.params.valueT, order.params.feeM,
                                    order.params.feeT, order.params.expiration, order.params.salt]);
      if (cancelValuesT.length < orders.length) {
        batchCancel.cancelValuesT.push(order.params.valueT);
      }
    });
    return batchCancel;
  },
};
