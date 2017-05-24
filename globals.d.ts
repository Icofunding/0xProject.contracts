declare module 'bn.js';
declare module 'ethereumjs-abi';
declare module 'es6-promisify';

declare module '*.json' {
    const json: any;
    /* tslint:disable */
    export default json;
    /* tslint:enable */
}

// Truffle injects the following into the global scope
declare var web3: any; // TODO: figure out how to use Web3 definition from within global.d.ts instead of `any`
declare var artifacts: any;
declare var contract: any;
declare var before: any;
declare var beforeEach: any;
declare var describe: any;
declare var it: any;

declare module 'ethereumjs-util' {
  function bufferToHex(value: Buffer): string;
  function ecrecover(msgHash: Buffer, v: number, r: Buffer, s: Buffer): Buffer;
  function fromRpcSig(sig: string): {v: number, r: Buffer, s: Buffer};
  function hashPersonalMessage(hash: Buffer): Buffer;
  function isHexString(value: any): boolean;
  function pubToAddress(pubKey: Buffer, sanitize?: boolean): Buffer;
  function setLength(a: Buffer, length: number): Buffer;
  function setLengthLeft(a: Buffer, length: number): Buffer;
  function sha3(a: Buffer|string|number, bits?: number): Buffer;
  function toBuffer(value: any): Buffer;
  function isValidAddress(address: string): boolean;

  export = {
            bufferToHex,
            ecrecover,
            fromRpcSig,
            hashPersonalMessage,
            isHexString,
            pubToAddress,
            setLength,
            setLengthLeft,
            sha3,
            toBuffer,
            isValidAddress,
          };
}

// Bignumber.js interface
declare module 'bignumber.js' {

    class BigNumber {
        // Those static attributes could have been in the module, a few lines beneath
        public static ROUND_DOWN: any;
        public isBigNumber: boolean;
        public static config(arg: any): void;
        public static random(numDecimals: number): BigNumber;

        constructor(value: number|string|BigNumber);
        public toNumber(): number;
        public toString(base?: number): string;
        public div(value: BigNumber|number): BigNumber;
        public pow(exponent: BigNumber|number): BigNumber;
        public times(value: BigNumber): BigNumber;
        public plus(value: BigNumber|number): BigNumber;
        public lt(value: BigNumber|number): BigNumber;
        public gte(value: BigNumber|number): BigNumber;
        public gt(value: BigNumber|number): BigNumber;
        public eq(value: BigNumber|number): BigNumber;
        public minus(value: BigNumber): BigNumber;
        public comparedTo(value: BigNumber): number;
        public round(numDecimals?: BigNumber|number): BigNumber;
    }

    // A standalone class is not exportable, so there is an empty module
    namespace BigNumber { }

    // The exported values is the merge of the BigNumber class and the BigNumber module
    export = BigNumber;
}
