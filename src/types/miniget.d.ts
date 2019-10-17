
declare module "miniget" {
  import { ServerResponse } from "http";
  import { RequestOptions } from 'https';

  export default function(url: string, options: RequestOptions, callback: (error: Error | undefined, response: ServerResponse, body: any) => any): void
}