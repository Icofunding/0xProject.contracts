var Exchange = artifacts.require('./Exchange.sol');
var Proxy = artifacts.require('./Proxy.sol');
var DummyTokenA = artifacts.require('./DummyTokenA');
var DummyTokenB = artifacts.require('./DummyTokenB');

contract('Exchange', (accounts) => {
  before((done) => {
    DummyTokenA.deployed()
      .then((dummyA) => {
        dummyA.approve(Proxy.address, web3.toWei(1000, 'ether'), { from: accounts[0] });
        dummyA.approve(Proxy.address, web3.toWei(1000, 'ether'), { from: accounts[1] });
      })
      .then(() => {
        DummyTokenB.deployed()
        .then((dummyB) => {
          dummyB.approve(Proxy.address, web3.toWei(1000, 'ether'), { from: accounts[0] });
          dummyB.approve(Proxy.address, web3.toWei(1000, 'ether'), { from: accounts[1] });
        })
        .then(() => done());
      });
  });

  it('should have accounts', () => {
    console.log(accounts)
  });
});
