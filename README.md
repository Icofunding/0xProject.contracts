# [0x Smart Contracts](https://0xProject.com)
---
![0x](https://github.com/0xProject/0xProject.github.io/blob/master/img/logo/logo50.png)

[![Slack Status](http://slack.0xProject.com/badge.svg)](http://slack.0xProject.com)

[0x](https://0xProject.com) is an open protocol that facilitates trustless and low-friction exchange of Ethereum-based assets. This repository contains the system of Ethereum smart contracts comprising 0x protocol's shared settlement layer, native token (ZRX) and decentralized governance structure. Truffle is used for deployment. Mocha and Chai are used for unit tests.

## Architecture

<img src="https://docs.google.com/drawings/d/18BvwiMAJhQ8g_LQ5sLagnfLh3UzVlmTcIrDBdCSLxo0/pub?w=1002&h=548" />

## Contracts

### [Exchange.sol](https://github.com/0xProject/contracts/tree/master/contracts/Exchange.sol)
Exchange contains all business logic associated with executing trades and cancelling orders. It accepts order objects that conform to 0x protocol message format, allowing for off-chain order relay with on-chain settlement. Exchange is designed to be replaced as protocol improvements are adopted over time. It follows that Exchange does not have direct access to ERC20 token allowances; instead, all transfers are carried out by Proxy on behalf of Exchange.

### [Proxy.sol](https://github.com/0xProject/contracts/tree/master/contracts/Proxy.sol)
Proxy is analagous to a valve that may be opened or shut by MultiSigWallet, either allowing or preventing Exchange from executing trades. Proxy plays a key role in 0x protocol's update mechanism: old versions of the Exchange contract may be deprecated, preventing them from executing further trades. New and improved versions of the Exchange contract are given permission to execute trades through decentralized governance implemented within a DAO (for now we use MultiSigWallet as a placeholder for DAO).

### [MultiSigWallet.sol](https://github.com/0xProject/contracts/tree/master/contracts/MultiSigWallet.sol)
MultiSigWallet is a temporary placeholder contract that will be replaced by a thoroughly researched, tested and audited DAO. MultiSigWallet is the only entity with permission to grant or revoke access to the Proxy and, by extension, ERC20 token allowances. MultiSigWallet is assigned as the `owner` of Proxy and, once a suitable DAO is developed, MultiSigWallet will call `Proxy.transferOwnership(DAO)` to transfer permissions to the DAO.

### [TokenRegistry.sol](https://github.com/0xProject/contracts/tree/master/contracts/TokenRegistry.sol)
TokenRegistry stores metadata associated with ERC20 tokens. TokenRegistry entries may only be created/modified/removed by MultiSigWallet (until it is replaced by a suitable DAO), meaning that information contained in the registry will generally be trustworthy. 0x message format is not human-readable making it difficult to visually verify order parameters (token addresses and exchange rates); the TokenRegistry can be used to quickly verify order parameters against audited metadata.

## Setup

Install [Node v6.9.1](https://nodejs.org/en/download/releases/)

Install truffle

```
npm i -g truffle@^3.2.1
```

Install ethereumjs-testrpc

```
npm i -g ethereumjs-testrpc@^3.0.2
```

Install project dependencies:

```
npm install
```

### Running tests

Start Testrpc

```
testrpc --networkId 42
```

Compile contracts

```
truffle compile
```

Run tests

```
npm run test
```

### Contributing

#### Style guide

We adhere to the [Airbnb javascript style guide](https://github.com/airbnb/javascript).

In order to see style violation errors, install an eslinter for your text editor. e.g Atom's [linter-eslint](https://atom.io/packages/linter-eslint).
