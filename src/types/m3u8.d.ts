declare module "m3u8" {
  import { Writable } from "stream";

  export function createStream(): Writable
}