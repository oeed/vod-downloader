import { Codec, CodecHeaders } from "codec.types";
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from "https";
import * as m3u8 from 'm3u8';
import m3u8stream from 'm3u8stream';
import * as path from "path";
import { Connection } from "proxy";
import { Logger } from "show-check";
import stringStream from 'string-to-stream';

export enum VideoEncryption {
  renditionKey
}

const determineRenditionKey = (url: string, { get, options }: Connection) => new Promise<{ key: Buffer, iv: Buffer, segmentCount: number }>(async resolve => {
  const { body: videoRendition } = await get(url, {})
  const segmentCount = (videoRendition.match(/#EXTINF:/g)||[]).length
  const [_, keyUrl, ivStr] = videoRendition.substr(0, 1000).match(/URI="([^\"]+)",IV=0x([0-9a-fA-F]+)/)
  const iv = Buffer.from(ivStr, "hex")
  https.get(options.transform({ href: keyUrl, headers: {} }), res => {
    const data: Buffer[] = [];
    res.on('data', function(chunk) {
      data.push(chunk);
    }).on('end', function()  {
        const key = Buffer.concat(data);
        resolve({ key, iv, segmentCount })
    });
  })
})

const downloadStream = (log: Logger, url: string, fileName: string, encryptionMethod: VideoEncryption | undefined, connection: Connection) => new Promise(async (resolve, reject) => {
  const encryption = encryptionMethod === VideoEncryption.renditionKey ? await determineRenditionKey(url, connection) : undefined
  const stream = m3u8stream(url, { parser: "m3u8", requestOptions: Object.assign({ headers: {} }, connection.options) })

  stream.on("error", (err: Error) => {
    reject(err)
  })
  let chunks: Buffer[] = []
  stream.on('readable', () => {
    const buffer = stream.read()
    if (buffer !== null) {
      chunks.push(buffer)
    }
  })

  const file = fs.createWriteStream(fileName)
  stream.on("progress", (data: { num: number }) => {
    let content: Buffer
    if (encryption) {
      const { key, iv, segmentCount } = encryption
      log(`${ fileName }: Segment done: ${ data.num }/${ segmentCount } ${ (data.num / segmentCount * 100).toFixed(1) }%`)
      let decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
      content = decipher.update(Buffer.concat(chunks));
    }
    else {
      log(`${ fileName }: Segment done: ${ data.num }`)
      content = Buffer.concat(chunks)
    }
    chunks = []
    file.write(content)

    ;(stream as any).end()
  })
  stream.on("end", () => {
    file.end()
    resolve()
  })
})

export const M3U8: Codec = {

  downloadPlaylist: (log: Logger, fileID: string, platlistURL: string, connection: Connection, encryption?: VideoEncryption, headers: CodecHeaders = {}) => new Promise(async resolve => {
    const { body: manifest} = await connection.get(platlistURL, headers)

    var parser = m3u8.createStream();
    stringStream(manifest).pipe(parser)
    parser.on('m3u', async function(m3u: any) {
      // pick the best quality video
      let video
      for (const item of m3u.items.StreamItem) {
        if (!video || item.attributes.attributes.bandwidth > video.attributes.attributes.bandwidth) {
          video = item
        }
      }

      // then get the corresponding audio
      let audio: any | undefined
      for (const item of m3u.items.MediaItem) {
        if (item.attributes.attributes["group-id"] == video.attributes.attributes.audio) {
          audio = item
          break
        }
      }

      if (!fs.existsSync(path.join(__dirname, "../../output"))){
        fs.mkdirSync(path.join(__dirname, "../../output"));
      }

      log("Get video...")
      const VIDEO_PATH = path.join(__dirname, `../../output/${ fileID }.mp4`)
      await downloadStream(log, video.properties.uri, VIDEO_PATH, encryption, connection)

      if (audio) {
        log("Get audio...")
        const AUDIO_PATH = path.join(__dirname, `../../output/${ fileID }.m4a`)
        await downloadStream(log, audio.attributes.attributes.uri, AUDIO_PATH, encryption, connection)

        resolve({
          audio: AUDIO_PATH,
          video: VIDEO_PATH
        })
      }
      else {
        log("Audio not separate...")
        resolve(VIDEO_PATH)
      }
    })
  })

}