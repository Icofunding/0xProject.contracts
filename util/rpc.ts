import * as request from 'request-promise-native';
import * as truffleConf from '../truffle.js';

export class RPC {
  private host: string;
  private port: number;
  private id: number;
  constructor() {
    this.host = truffleConf.networks.development.host;
    this.port = truffleConf.networks.development.port;
    this.id = 0;
  }
  public async increaseTimeAsync(time: number) {
    const method = 'evm_increaseTime';
    const params = [time];
    const payload = this.toPayload(method, params);
    return this.sendAsync(payload);
  }
  public async mineBlockAsync() {
    const method = 'evm_mine';
    const payload = this.toPayload(method);
    return this.sendAsync(payload);
  }
  private toPayload(method: string, params: any[] = []) {
    const payload = JSON.stringify({
      id: this.id,
      method,
      params,
    });
    this.id += 1;
    return payload;
  }
  private async sendAsync(payload: string) {
    const opts = {
      method: 'POST',
      uri: `http://${this.host}:${this.port}`,
      body: payload,
    };
    const body = await request(opts);
    return body.result;
  }
}
