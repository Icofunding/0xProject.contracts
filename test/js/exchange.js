const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const DummyTokenB = artifacts.require('./DummyTokenB.sol');
const DummyProtocolToken = artifacts.require('./DummyProtocolToken.sol');

const utils = require('../../utils/index.js')(web3);

contract('Exchange', accounts => {
  const maker = accounts[0];
  const taker = accounts[1] || accounts[accounts.length - 1];
  const feeRecipient = accounts[2] || accounts[accounts.length - 1];

  let dummyA;
  let dummyB;
  let dummyPT;
  let exchange;

  before(done => {
    Exchange.deployed().then(instance => {
      exchange = instance;
    }).then(() => {
      DummyTokenA.deployed().then(instance => {
        dummyA = instance;
        return Promise.all([
          dummyA.approve(Proxy.address, 1000, { from: maker }),
          dummyA.approve(Proxy.address, 1000, { from: taker }),
          dummyA.buy(1000, { from: maker }),
          dummyA.buy(1000, { from: taker })
        ]).then(() => {
          DummyTokenB.deployed().then(instance => {
            dummyB = instance;
            return Promise.all([
              dummyB.approve(Proxy.address, 1000, { from: maker }),
              dummyB.approve(Proxy.address, 1000, { from: taker }),
              dummyB.buy(1000, { from: maker }),
              dummyB.buy(1000, { from: taker })
            ]).then(() => {
              DummyProtocolToken.deployed().then(instance => {
                dummyPT = instance;
                return Promise.all([
                  dummyPT.approve(Proxy.address, 1000, { from: maker }),
                  dummyPT.approve(Proxy.address, 1000, { from: taker }),
                  dummyPT.buy(1000, { from: maker }),
                  dummyPT.buy(1000, { from: taker })
                ]).then(() => done());
              });
            });
          });
        });
      });
    });
  });

  describe('fill single order', () => {
    let order;

    beforeEach(done => {
      utils.createOrder({
        exchange: Exchange.address,
        maker,
        feeRecipient,
        tokenM: DummyTokenA.address,
        tokenT: DummyTokenB.address,
        valueM: 10000,
        valueT: 10000,
        feeM: 1,
        feeT: 1,
        expiration: Date.now() + 100000
      }).then(res => {
        order = res;
        console.log(order);
        done();
      });
    });

    it('should have accounts', done => {
      dummyA.balanceOf(maker)
      .then(balance => {
        console.log(balance.toString())
        done();
      })
    });
  });

});
