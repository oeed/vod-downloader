
declare module "socks-proxy-agent" {
  import { Agent } from "https";

  export default class SocksProxyAgent extends Agent {
    constructor(url: string)
  }

}