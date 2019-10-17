import * as crypto from 'crypto';
import EncryptionMethod from 'encryption';
import * as https from "https";
import { Connection } from "proxy";

export default class RenditionEncryption implements EncryptionMethod {

  algorithm: string
  key: Buffer
  iv: Buffer

  constructor(algorithm = "aes-128-cbc") {
    this.algorithm = algorithm
  }

  prepareStream = (url: string, { get, options }: Connection) => new Promise<void>(async resolve => {
    // const _this = this
    const { body: videoRendition } = await get(url, {})
    // const segmentCount = (videoRendition.match(/#EXTINF:/g)||[]).length
    const [_, keyUrl, ivStr] = videoRendition.substr(0, 1000).match(/URI="([^\"]+)",IV=0x([0-9a-fA-F]+)/)
    this.iv = Buffer.from(ivStr, "hex")
    https.get(options.transform({ href: keyUrl, headers: {} }), res => {
      const data: Buffer[] = [];
      res.on('data', chunk => {
        data.push(chunk)
      }).on('end', () =>  {
          this.key = Buffer.concat(data);
          resolve()
      });
    })
  })

  decryptSegment(buffer: Buffer) {
    let decipher = crypto.createDecipheriv(this.algorithm, this.key, this.iv);
    return decipher.update(buffer)
  }


}