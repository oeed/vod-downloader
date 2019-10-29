import { Connection } from "proxy";

export default interface EncryptionMethod {

  prepareStream(url: string, connetion: Connection): Promise<void>
  decryptSegment(buffer: Buffer, segmentNumber: number): Promise<Buffer> | Buffer

}