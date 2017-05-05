import * as _ from 'lodash';
import { Order } from './order';
import { OrderParams, DefaultOrderParams, OptionalOrderParams } from './types';

export class OrderFactory {
  private defaultOrderParams: DefaultOrderParams;
  constructor(defaultOrderParams: DefaultOrderParams) {
    this.defaultOrderParams = defaultOrderParams;
  }
  public async newSignedOrderAsync(customOrderParams: OptionalOrderParams = {}) {
    const randomExpiration = Math.floor((Date.now() + (Math.random() * 100000000000)) / 1000);
    const randomSalt = Math.floor(Math.random() * 100000000000);
    const orderParams = _.assign({}, {
      expiration: randomExpiration,
      salt: randomSalt,
      taker: '0x0',
    }, this.defaultOrderParams, customOrderParams);
    const order = new Order(orderParams);
    await order.signAsync();
    return order;
  }
}
