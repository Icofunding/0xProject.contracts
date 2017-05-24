import * as BigNumber from 'bignumber.js';

export interface BalancesByOwner {
  [ownerAddress: string]: {
    [tokenAddress: string]: string;
  };
}

export interface BatchFill {
  orderAddresses: string[][];
  orderValues: BigNumber.BigNumber[][];
  fillValuesT: BigNumber.BigNumber[];
  shouldCheckTransfer: boolean;
  v: number[];
  r: string[];
  s: string[];
}

export interface FillUpTo {
  orderAddresses: string[][];
  orderValues: BigNumber.BigNumber[][];
  fillValueT: BigNumber.BigNumber;
  shouldCheckTransfer: boolean;
  v: number[];
  r: string[];
  s: string[];
}

export interface BatchCancel {
  orderAddresses: string[][];
  orderValues: BigNumber.BigNumber[][];
  cancelValuesT: BigNumber.BigNumber[];
}

export interface DefaultOrderParams {
  exchange: string;
  maker: string;
  feeRecipient: string;
  tokenM: string;
  tokenT: string;
  valueM: BigNumber.BigNumber;
  valueT: BigNumber.BigNumber;
  feeM: BigNumber.BigNumber;
  feeT: BigNumber.BigNumber;
}

export interface OptionalOrderParams {
  exchange?: string;
  maker?: string;
  taker?: string;
  feeRecipient?: string;
  tokenM?: string;
  tokenT?: string;
  valueM?: BigNumber.BigNumber;
  valueT?: BigNumber.BigNumber;
  feeM?: BigNumber.BigNumber;
  feeT?: BigNumber.BigNumber;
  expiration?: BigNumber.BigNumber;
}

export interface OrderParams {
  exchange: string;
  maker: string;
  taker: string;
  feeRecipient: string;
  tokenM: string;
  tokenT: string;
  valueM: BigNumber.BigNumber;
  valueT: BigNumber.BigNumber;
  feeM: BigNumber.BigNumber;
  feeT: BigNumber.BigNumber;
  expiration: BigNumber.BigNumber;
  salt: BigNumber.BigNumber;
  orderHashHex?: string;
  v?: number;
  r?: string;
  s?: string;
}

export interface ABIEntity {
  constant: boolean;
  inputs: Array<{
    name: string;
    type: string;
  }>;
  name: string;
  outputs: Array<{
    name: string;
    type: string;
  }>;
  payable: boolean;
  type: string;
}

export interface TransactionDataParams {
  name: string;
  abi: ABIEntity[];
  args: any[];
}

export interface Token {
  address?: string;
  name: string;
  symbol: string;
  url: string;
  decimals: number;
  ipfsHash: string;
  swarmHash: string;
}

export interface MultiSigConfig {
  owners: string[];
  confirmationsRequired: number;
  secondsRequired: number;
}

export interface MultiSigConfigByNetwork {
  [networkName: string]: MultiSigConfig;
}

export interface TokenInfoByNetwork {
  development: Token[];
  live: Token[];
}

// Named type aliases to improve readability
export type ContractInstance = any;

export enum ExchangeContractErrs {
  ERROR_FILL_EXPIRED,
  ERROR_FILL_NO_VALUE,
  ERROR_FILL_TRUNCATION,
  ERROR_FILL_BALANCE_ALLOWANCE,
  ERROR_CANCEL_EXPIRED,
  ERROR_CANCEL_NO_VALUE,
}
