export class Artifacts {
  public Migrations: any;
  public Proxy: any;
  public TokenRegistry: any;
  public MultiSigWallet: any;
  public Exchange: any;
  public ProtocolToken: any;
  public DummyToken: any;
  public DummyEtherToken: any;
  constructor(artifacts: any) {
    this.Migrations = artifacts.require('Migrations');
    this.Proxy = artifacts.require('Proxy');
    this.TokenRegistry = artifacts.require('TokenRegistry');
    this.MultiSigWallet = artifacts.require('MultiSigWallet');
    this.Exchange = artifacts.require('Exchange');
    this.ProtocolToken = artifacts.require('ProtocolToken');
    this.DummyToken = artifacts.require('DummyToken');
    this.DummyEtherToken = artifacts.require('DummyEtherToken');
  }
}
