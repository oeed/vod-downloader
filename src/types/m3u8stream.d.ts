declare module "m3u8stream" {
  import { RequestOptions } from 'https';
  import { Readable } from "stream";

  function m3u8stream(url: string, options: { parser: string, requestOptions: RequestOptions }): Readable
  export = m3u8stream
}