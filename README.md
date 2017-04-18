0x Smart Contracts
------------------

### Setup

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

Start testrpc

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
