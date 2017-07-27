export class Artifacts {
  public Migrations: any;
  public TokenProxy: any;
  public TokenRegistry: any;
  public MultiSigWalletWithTimeLock: any;
  public Exchange: any;
  public ZRXToken: any;
  public DummyToken: any;
  public EtherToken: any;
  public TokenSaleWithRegistry: any;
  public MultiSigWalletWithTimeLockExceptRemoveAuthorizedAddress: any;
  public MaliciousToken: any;
  constructor(artifacts: any) {
    this.Migrations = artifacts.require('Migrations');
    this.TokenProxy = artifacts.require('TokenProxy');
    this.TokenRegistry = artifacts.require('TokenRegistry');
    this.MultiSigWalletWithTimeLock = artifacts.require('MultiSigWalletWithTimeLock');
    this.Exchange = artifacts.require('Exchange');
    this.ZRXToken = artifacts.require('ZRXToken');
    this.DummyToken = artifacts.require('DummyToken');
    this.EtherToken = artifacts.require('EtherToken');
    this.TokenSaleWithRegistry = artifacts.require('TokenSaleWithRegistry');
    this.MultiSigWalletWithTimeLockExceptRemoveAuthorizedAddress = artifacts.require('MultiSigWalletWithTimeLockExceptRemoveAuthorizedAddress');
    this.MaliciousToken = artifacts.require('MaliciousToken');
  }
}
