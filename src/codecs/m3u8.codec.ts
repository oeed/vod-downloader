import { Codec } from "codec.types";
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from "https";
import * as m3u8 from 'm3u8';
import m3u8stream from 'm3u8stream';
import * as path from "path";
import { Connection } from "proxy";
import stringStream from 'string-to-stream';

const determineRenditionKey = (url: string, { get, options }: Connection) => new Promise<{ key: Buffer, iv: Buffer, segmentCount: number }>(async resolve => {
  const { body: videoRendition} = await get(url, {})
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

const downloadStream = (url: string, fileName: string, connection: Connection) => new Promise(async (resolve, reject) => {
  const { key, iv, segmentCount } = await determineRenditionKey(url, connection)
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
    console.log(`${ fileName }: Segment done: ${ data.num }/${ segmentCount } ${ (data.num / segmentCount * 100).toFixed(1) }%`)
    let decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    let decrypted = decipher.update(Buffer.concat(chunks));
    chunks = []
    file.write(decrypted)

    ;(stream as any).end()
  })
  stream.on("end", () => {
    file.end()
    resolve()
  })
})

export const M3U8: Codec = {

  downloadPlaylist: (fileID: string, platlistURL: string, connection: Connection) => new Promise(async resolve => {
    const { body: manifest} = await connection.get(platlistURL, { "Accept": "application/json;pk=BCpkADawqM3LrTsmy4tDkB6PwE5QiKnkQF0gsdyOVDmJNyCmpHG8FbEekN-V2-y5KmH5nyVJ-8HVv9rMX37nUed-zfUhOFiHwA3XhW35sjvr_qk92T8f2dbdA9vLN-wzvdaChZeUqcj3wQOf" })

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
      let audio
      for (const item of m3u.items.MediaItem) {
        if (item.attributes.attributes["group-id"] == video.attributes.attributes.audio) {
          audio = item
          break
        }
      }

      if (!fs.existsSync(path.join(__dirname, "../../output"))){
        fs.mkdirSync(path.join(__dirname, "../../output"));
      }

      console.log("Get audio...")
      const AUDIO_PATH = path.join(__dirname, `../../output/${ fileID }.m4a`)
      await downloadStream(audio.attributes.attributes.uri, AUDIO_PATH, connection)

      console.log("Get video...")
      const VIDEO_PATH = path.join(__dirname, `../../output/${ fileID }.mp4`)
      await downloadStream(video.properties.uri, VIDEO_PATH, connection)

      resolve({
        audio: AUDIO_PATH,
        video: VIDEO_PATH
      })
    })
  })

}