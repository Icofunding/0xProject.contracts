const Order = require('./order');

class OrderFactory {
  constructor(defaultOrderParams) {
    this.defaultOrderParams = defaultOrderParams;
  }
  async newSignedOrderAsync(customOrderParams = {}) {
    const randomExpiration = Math.floor((Date.now() + (Math.random() * 100000000000)) / 1000);
    const orderParams = Object.assign({}, {
      expiration: randomExpiration,
      taker: '0x0',
    }, this.defaultOrderParams, customOrderParams);
    const order = new Order(orderParams);
    await order.signAsync();
    return order;
  }
}

module.exports = OrderFactory;
