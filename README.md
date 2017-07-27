<img src="https://github.com/0xProject/branding/blob/master/0x_Black_CMYK.png" width="200px" >

---

[0x][website-url] is an open protocol that facilitates trustless, low friction exchange of Ethereum-based assets. A full description of the protocol may be found in our [whitepaper][whitepaper-url]. This repository contains the system of Ethereum smart contracts comprising 0x protocol's shared on-chain settlement layer, native token (ZRX) and decentralized governance structure. Truffle is used for deployment. Mocha is used for unit tests.

[website-url]: https://0xproject.com/
[whitepaper-url]: https://0xproject.com/pdfs/0x_white_paper.pdf

[![Slack Status](http://slack.0xProject.com/badge.svg)](http://slack.0xProject.com)
[![Join the chat at https://gitter.im/0xProject/contracts](https://badges.gitter.im/0xProject/contracts.svg)](https://gitter.im/0xProject/contracts?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Table of Contents

* [Architecture](#architecture)
* [Contracts](#contracts)
    * [Descriptions](#descriptions)
    * [Deployed Addresses](#deployed-addresses)
        * [Kovan](#kovan)
* [Protocol Specification](#protocol-specification)
    * [Message Format](#message-format)
* [Setup](#setup)
    * [Installing Dependencies](#install-dependencies)
    * [Running Tests](#running-tests)
    * [Contributing](#contributing)

## Architecture

<img src="https://docs.google.com/drawings/d/18BvwiMAJhQ8g_LQ5sLagnfLh3UzVlmTcIrDBdCSLxo0/pub?w=1002&h=548" />

## Contracts

### Descriptions

#### [Exchange.sol](https://github.com/0xProject/contracts/tree/master/contracts/Exchange.sol)
Exchange contains all business logic associated with executing trades and cancelling orders. Exchange accepts orders that conform to 0x message format, allowing for off-chain order relay with on-chain settlement. Exchange is designed to be replaced as protocol improvements are adopted over time. It follows that Exchange does not have direct access to ERC20 token allowances; instead, all transfers are carried out by TokenProxy on behalf of Exchange.

#### [TokenProxy.sol](https://github.com/0xProject/contracts/tree/master/contracts/TokenProxy.sol)
TokenProxy is analagous to a valve that may be opened or shut by MultiSigWalletWithTimeLock, either allowing or preventing Exchange from executing trades. TokenProxy plays a key role in 0x protocol's update mechanism: old versions of the Exchange contract may be deprecated, preventing them from executing further trades. New and improved versions of the Exchange contract are given permission to execute trades through decentralized governance implemented within a DAO (for now we use MultiSigWallet as a placeholder for DAO).

#### [MultiSigWalletWithTimeLock.sol](https://github.com/0xProject/contracts/tree/master/contracts/MultiSigWalletWithTimeLock.sol)
MultiSigWalletWithTimeLock is a temporary placeholder contract that will be replaced by a thoroughly researched, tested and audited DAO. MultiSigWalletWithTimeLock is based upon the [MultiSigWallet](https://github.com/ConsenSys/MultiSigWallet) contract developed by the Gnosis team, but with an added mandatory time delay between when a proposal is approved and when that proposal may be executed. This speed bump ensures that the multi sig owners cannot conspire to push through a change to 0x protocol without end users having sufficient time to react. MultiSigWalletWithTimeLock is the only entity with permission to grant or revoke access to the TokenProxy and, by extension, ERC20 token allowances. MultiSigWalletWithTimeLock is assigned as the `owner` of TokenProxy and, once a suitable DAO is developed, MultiSigWalletWithTimeLock will call `TokenProxy.transferOwnership(DAO)` to transfer permissions to the DAO.

#### [TokenRegistry.sol](https://github.com/0xProject/contracts/tree/master/contracts/TokenRegistry.sol)
TokenRegistry stores metadata associated with ERC20 tokens. TokenRegistry entries may only be created/modified/removed by MultiSigWallet (until it is replaced by a suitable DAO), meaning that information contained in the registry will generally be trustworthy. 0x message format is not human-readable making it difficult to visually verify order parameters (token addresses and exchange rates); the TokenRegistry can be used to quickly verify order parameters against audited metadata.

### Deployed Addresses

#### Kovan

* Exchange.sol: [0xed97b186ee3bae12a3fe6a9fb55300b5630a1b4c](https://kovan.etherscan.io/address/0xed97b186ee3bae12a3fe6a9fb55300b5630a1b4c)
* TokenProxy.sol: [0x946a1c437fb5a61bd5c95416346e684c802c5d2a](https://kovan.etherscan.io/address/0x946a1c437fb5a61bd5c95416346e684c802c5d2a)
* MultiSigWalletWithTimeLock.sol: [0xa9a207b3df3f0d3ca33acf399e9af5db5902db39](https://kovan.etherscan.io/address/0xa9a207b3df3f0d3ca33acf399e9af5db5902db39)
* TokenRegistry.sol: [0x0fea265f59495859467e648ec99a87549aa6ede0](https://kovan.etherscan.io/address/0x0fea265f59495859467e648ec99a87549aa6ede0)

## Protocol Specification

### Message Format

Each order is a data packet containing order parameters and an associated signature. Order parameters are concatenated and hashed to 32 bytes via the Keccak SHA3 function. The order originator signs the order hash with their private key to produce an ECDSA signature.

Name | Data Type | Description
--- | --- | ---
exchangeContractAddress | `address` | Address of the Exchange contract. This address will change each time the protocol is updated.
maker | `address` | Address originating the order.
taker | `address` | Address permitted to fill the order (optional).
makerToken | `address` | Address of an ERC20 Token contract.
takerToken | `address` | Address of an ERC20 Token contract.
makerTokenAmount | `uint256` | Total units of makerToken offered by maker.
takerTokenAmount | `uint256` | Total units of takerToken requested by maker.
expirationTimestampInSec | `uint256` | Time at which the order expires (seconds since unix epoch).
salt | `uint256` | Arbitrary number that allows for uniqueness of the order's Keccak SHA3 hash.
feeRecipient | `address` | Address that recieves transaction fees (optional).
makerFee | `uint256` | Total units of ZRX paid to feeRecipient by maker.
takerFee | `uint256` | Total units of ZRX paid to feeRecipient by taker.
v | `uint8` | ECDSA signature of the above arguments.
r | `bytes32` | ECDSA signature of the above arguments.
s | `bytes32` | ECDSA signature of the above arguments.

## Setup

### Installing Dependencies

Install [Node v6.9.1](https://nodejs.org/en/download/releases/)

Install project dependencies:

```
npm install
```

### Running Tests

Start Testrpc

```
npm run testrpc
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
