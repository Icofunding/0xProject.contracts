import * as _ from 'lodash';
import { Order } from './order';
import { OrderParams, DefaultOrderParams, OptionalOrderParams } from './types';
import { constants } from './constants';
import * as BigNumber from 'bignumber.js';

const MAX_DIGITS_IN_UNSIGNED_256_INT = 78;

export class OrderFactory {
  private defaultOrderParams: DefaultOrderParams;
  constructor(defaultOrderParams: DefaultOrderParams) {
    this.defaultOrderParams = defaultOrderParams;
  }
  public async newSignedOrderAsync(customOrderParams: OptionalOrderParams = {}) {
    const randomExpiration = new BigNumber(Math.floor((Date.now() + (Math.random() * 100000000000)) / 1000));
    const orderParams: OrderParams = _.assign({}, {
      expirationTimestampInSec: randomExpiration,
      salt: this.generateSalt(),
      taker: constants.NULL_ADDRESS,
    }, this.defaultOrderParams, customOrderParams);
    const order = new Order(orderParams);
    await order.signAsync();
    return order;
  }
  private generateSalt() {
      const randomNumber = BigNumber.random(MAX_DIGITS_IN_UNSIGNED_256_INT);
      const factor = new BigNumber(10).pow(MAX_DIGITS_IN_UNSIGNED_256_INT - 1);
      const salt = randomNumber.times(factor).round();
      return salt;
  }
}
