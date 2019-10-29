import * as crypto from 'crypto';
import EncryptionMethod from 'encryption';
import * as https from "https";
import { Connection } from "proxy";

export default class RenditionEncryption implements EncryptionMethod {

  algorithm: string
  key: Buffer
  iv: Buffer
  
  sequence: number
  useSequenceAsIV: boolean

  constructor(algorithm = "aes-128-cbc", useSequenceAsIV = false) {
    this.algorithm = algorithm
    this.useSequenceAsIV = useSequenceAsIV
  }

  prepareStream = (url: string, { get, options }: Connection) => new Promise<void>(async resolve => {
    // const _this = this
    const { body: videoRendition } = await get(url, {})

    // const segmentCount = (videoRendition.match(/#EXTINF:/g)||[]).length
    if (this.useSequenceAsIV) {
      const [__, ivStr] = videoRendition.substr(0, 1000).match(/^#EXT-X-MEDIA-SEQUENCE:(\d+)/m)

      this.sequence = parseInt(ivStr)
    }
    else {
      const [__, ivStr] = videoRendition.substr(0, 1000).match(/URI="[^\"]+",IV=0x([0-9a-fA-F]+)/)
      this.iv = Buffer.from(ivStr, "hex")
    }

    const [_, keyUrl] = videoRendition.substr(0, 1000).match(/^#EXT-X-KEY:.+URI="([^\"]+)"/m)
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

  decryptSegment(buffer: Buffer, segmentNumber: number) {
    let iv: Buffer
    if (this.useSequenceAsIV) {
      iv = new Buffer(16)
      iv.writeUInt32BE(this.sequence + segmentNumber, 0)
    }
    else {
      iv = this.iv
    }
    let decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    return decipher.update(buffer)
  }


}