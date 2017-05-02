# [0x Smart Contracts](https://0xProject.com)
---

![0x](https://github.com/0xProject/0xProject.github.io/blob/master/img/logo/logo50.png)

[![Slack Status](http://slack.0xProject.com/badge.svg)](http://slack.0xProject.com)
[![Join the chat at https://gitter.im/0xProject/contracts](https://badges.gitter.im/0xProject/contracts.svg)](https://gitter.im/0xProject/contracts?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

[0x](https://0xProject.com) is an open protocol that facilitates trustless and low-friction exchange of Ethereum-based assets. This repository contains the system of Ethereum smart contracts comprising 0x protocol's shared settlement layer, native token (ZRX) and decentralized governance structure. Truffle is used for deployment. Mocha is used for unit tests.

## Architecture

<img src="https://docs.google.com/drawings/d/18BvwiMAJhQ8g_LQ5sLagnfLh3UzVlmTcIrDBdCSLxo0/pub?w=1002&h=548" />

## Contracts

### [Exchange.sol](https://github.com/0xProject/contracts/tree/master/contracts/Exchange.sol)
Exchange contains all business logic associated with executing trades and cancelling orders. Exchange accepts order data packets that conform to 0x protocol message format, allowing for off-chain order relay with on-chain settlement. Exchange is designed to be replaced as protocol improvements are adopted over time. It follows that Exchange does not have direct access to ERC20 token allowances; instead, all transfers are carried out by Proxy on behalf of Exchange.

### [Proxy.sol](https://github.com/0xProject/contracts/tree/master/contracts/Proxy.sol)
Proxy is analagous to a valve that may be opened or shut by MultiSigWallet, either allowing or preventing Exchange from executing trades. Proxy plays a key role in 0x protocol's update mechanism: old versions of the Exchange contract may be deprecated, preventing them from executing further trades. New and improved versions of the Exchange contract are given permission to execute trades through decentralized governance implemented within a DAO (for now we use MultiSigWallet as a placeholder for DAO).

### [MultiSigWallet.sol](https://github.com/0xProject/contracts/tree/master/contracts/MultiSigWallet.sol)
MultiSigWallet is a temporary placeholder contract that will be replaced by a thoroughly researched, tested and audited DAO. MultiSigWallet is the only entity with permission to grant or revoke access to the Proxy and, by extension, ERC20 token allowances. MultiSigWallet is assigned as the `owner` of Proxy and, once a suitable DAO is developed, MultiSigWallet will call `Proxy.transferOwnership(DAO)` to transfer permissions to the DAO.

### [TokenRegistry.sol](https://github.com/0xProject/contracts/tree/master/contracts/TokenRegistry.sol)
TokenRegistry stores metadata associated with ERC20 tokens. TokenRegistry entries may only be created/modified/removed by MultiSigWallet (until it is replaced by a suitable DAO), meaning that information contained in the registry will generally be trustworthy. 0x message format is not human-readable making it difficult to visually verify order parameters (token addresses and exchange rates); the TokenRegistry can be used to quickly verify order parameters against audited metadata.

# Protocol Specification

## Off-chain Relay, On-chain Settlement

## Message Format

Each order is a data packet containing order parameters and an associated signature. Order parameters are concatenated and hashed to 32 bytes via the Keccak SHA3 function. The order originator signs the order hash with their private key to produce an ECDSA signature.

Name | Data Type | Description
--- | --- | ---
version | `address` | Address of the Exchange contract. This address will change each time the protocol is updated.
maker | `address` | Address originating the order.
taker | `address` | Address permitted to fill the order (optional).
tokenM | `address` | Address of an ERC20 Token contract.
tokenT | `address` | Address of an ERC20 Token contract.
valueM | `uint256` | Total units of tokenM offered by maker.
valueT | `uint256` | Total units of tokenT requested by maker.
expiration | `uint256` | Time at which the order expires (seconds since unix epoch).
feeRecipient | `address` | Address that recieves transaction fees (optional).
feeM | `uint256` | Total units of ZRX paid to feeRecipient by maker.
feeT | `uint256` | Total units of ZRX paid to feeRecipient by taker.
v | `uint8` | ECDSA signature of the above arguments.
r | `bytes32` | ECDSA signature of the above arguments.
s | `bytes32` | ECDSA signature of the above arguments.

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
testrpc --networkId 50
```

Compile contracts

```
npm run compile
```

Run tests

```
npm run test
```

### Contributing

#### Coding conventions

We use a custom set of [TSLint](https://palantir.github.io/tslint/) rules to enforce our coding conventions.

In order to see style violation errors, install a tslinter for your text editor. e.g Atom's [atom-typescript](https://atom.io/packages/atom-typescript).
