# [0x Smart Contracts](https://0xProject.com)
---
![0x](https://github.com/0xProject/0xProject.github.io/blob/master/img/logo/logo50.png)

[![Slack Status](http://slack.0xProject.com/badge.svg)](http://slack.0xProject.com)

[0x](https://0xProject.com) is an open protocol that facilitates trustless and low-friction exchange of Ethereum-based assets. This repository contains the system of Ethereum smart contracts comprising 0x protocol's shared settlement layer, native token (ZRX) and decentralized governance structure. Truffle is used for deployment. Mocha and Chai are used for unit tests.

## Architecture

<img src="https://docs.google.com/drawings/d/18BvwiMAJhQ8g_LQ5sLagnfLh3UzVlmTcIrDBdCSLxo0/pub?w=1002&h=548" />

## Contracts

### [Exchange.sol](https://github.com/0xProject/contracts/tree/master/contracts/Exchange.sol)

### [Proxy.sol](https://github.com/0xProject/contracts/tree/master/contracts/Proxy.sol)

### [MultiSigWallet.sol](https://github.com/0xProject/contracts/tree/master/contracts/MultiSigWallet.sol)

### [TokenRegistry.sol](https://github.com/0xProject/contracts/tree/master/contracts/TokenRegistry.sol)

## Dev setup

Install an eslinter for your text editor. e.g Atom's [linter-eslint](https://atom.io/packages/linter-eslint).

Install truffle ^3.2.1

Install node ^6.9.1

Install ethereumjs-testrpc ^3.0.2

### Style guide

We follow the [Airbnb javascript style guide](https://github.com/airbnb/javascript).

### Running tests

Start Testrpc

```
testrpc --networkId 42
```

Compile/migrate contracts

```
truffle compile
```

```
truffle migrate
```

Run tests

```
truffle test
```
