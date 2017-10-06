<img src="https://github.com/0xProject/branding/blob/master/Icon_Black_CMYK.png" width="120px" >

---

[0x][website-url] is an open protocol that facilitates trustless, low friction exchange of Ethereum-based assets. A full description of the protocol may be found in our [whitepaper][whitepaper-url]. This repository contains the system of Ethereum smart contracts comprising 0x protocol's shared on-chain settlement layer, native token (ZRX) and decentralized governance structure. Truffle is used for deployment. Mocha is used for unit tests.

[website-url]: https://0xproject.com/
[whitepaper-url]: https://0xproject.com/pdfs/0x_white_paper.pdf

[![Slack Status](http://slack.0xProject.com/badge.svg)](http://slack.0xProject.com)
[![Join the chat at https://gitter.im/0xProject/contracts](https://badges.gitter.im/0xProject/contracts.svg)](https://gitter.im/0xProject/contracts?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Useful 0x Wiki Articles

* [Architecture](https://0xproject.com/wiki#Architecture)
* [Contract Interactions](https://0xproject.com/wiki#Contract-Interactions)
* [Contract deployed addresses](https://0xproject.com/wiki#Deployed-Addresses)
* [0x Protocol Message Format](https://0xproject.com/wiki#Message-Format)
* [Bug Bounty Program](https://0xproject.com/wiki#Bug-Bounty)

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

## Contributing

0x protocol is intended to serve as an open technical standard for EVM blockchains and we strongly encourage our community members to help us make improvements and to determine the future direction of the protocol. To report bugs within the 0x smart contracts or unit tests, please create an issue in this repository.

### ZEIPs
Significant changes to 0x protocol's smart contracts, architecture, message format or functionality should be proposed in the [0x Improvement Proposals (ZEIPs)](https://github.com/0xProject/ZEIPs) repository. Follow the contribution guidelines provided therein.

### Coding conventions

We use a custom set of [TSLint](https://palantir.github.io/tslint/) rules to enforce our coding conventions.

In order to see style violation errors, install a tslinter for your text editor. e.g Atom's [atom-typescript](https://atom.io/packages/atom-typescript).
