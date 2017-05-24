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

// Web3 interface
// modules that you require must be in quotes, or they'll be considered as ambient global variables.
declare module 'web3' {

    class Web3 {
        public static providers: typeof providers;

        public eth: {
            coinbase: string;
            defaultAccount: string;
            compile: {
                solidity(sourceString: string, cb?: (err: any, result: any) => void): object,
            }
            sign(address: string, message: string, callback: (err: Error, signData: string) => void): string;
            contract(abi: AbiDefinition[]): Contract;
            getBalance(addressHexString: string, callback?: (err: any, result: BigNumber.BigNumber) => void):
                       BigNumber.BigNumber;
            getCode(addressHexString: string, callback?: (err: any, code: string) => void): string;
            filter(value: string|FilterObject): FilterResult;
        };
        public setProvider(provider: providers.Provider): void;
        public fromWei(amount: BigNumber.BigNumber, unit: string): BigNumber.BigNumber;
    }

    interface AbiIOParameter {
        name: string;
        type: string;
    }

    interface AbiDefinition {
        constants: boolean;
        inputs: AbiIOParameter[];
        name: string;
        outputs: AbiIOParameter[];
        type: string;
    }

    interface Contract {}

    interface FilterObject {
        fromBlock: number|string;
        toBlock: number|string;
        address: string;
        topics: string[];
    }

    interface FilterResult {
        get(callback: () => void): void;
        watch(callback: () => void): void;
        stopWatching(): void;
    }

    namespace providers {
        interface Provider {
        }
        class HttpProvider implements Provider {
            constructor(url?: string);
        }
    }

    namespace Web3 {}

    export = Web3;
}
