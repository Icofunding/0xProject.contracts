export class Artifacts {
  public Migrations: any;
  public Proxy: any;
  public TokenRegistry: any;
  public MultiSigWalletWithTimeLock: any;
  public Exchange: any;
  public ProtocolToken: any;
  public DummyToken: any;
  public DummyEtherToken: any;
  public SimpleCrowdsale: any;
  constructor(artifacts: any) {
    this.Migrations = artifacts.require('Migrations');
    this.Proxy = artifacts.require('Proxy');
    this.TokenRegistry = artifacts.require('TokenRegistry');
    this.MultiSigWalletWithTimeLock = artifacts.require('MultiSigWalletWithTimeLock');
    this.Exchange = artifacts.require('Exchange');
    this.ProtocolToken = artifacts.require('ProtocolToken');
    this.DummyToken = artifacts.require('DummyToken');
    this.DummyEtherToken = artifacts.require('DummyEtherToken');
    this.SimpleCrowdsale = artifacts.require('SimpleCrowdsale');
  }
}
