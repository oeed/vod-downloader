import { Codec, CodecHeaders, StreamingCodec } from "codec.types";
import EncryptionMethod from "encryption";
import Ffmpeg from "fluent-ffmpeg";
import * as fs from 'fs';
import { Logger } from "log.helper";
import { DateTime } from "luxon";
import * as m3u8 from 'm3u8';
import m3u8stream from 'm3u8stream';
import * as path from "path";
import { Connection } from "proxy";
import stringStream from 'string-to-stream';

const downloadStream = (log: Logger, url: string, fileName: string, encryptionMethod: EncryptionMethod | undefined, connection: Connection) => new Promise(async (resolve, reject) => {
  if (encryptionMethod) {
    await encryptionMethod.prepareStream(url, connection)
  }
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
  stream.on("progress", async (data: { num: number }) => {
    let content: Buffer
    log(`${ fileName }: Segment done: ${ data.num }`)
    if (encryptionMethod) {
      content = await encryptionMethod.decryptSegment(Buffer.concat(chunks), data.num - 1)
      
    }
    else {
      content = Buffer.concat(chunks)
    }
    chunks = []
    file.write(content)

    if (process.env.NODE_ENV === "development") {
      ;(stream as any).end()
    }
  })
  stream.on("end", () => {
    file.end()
    resolve()
  })
})

export const M3U8: Codec & StreamingCodec = {

  downloadPlaylist: (log: Logger, fileID: string, platlistURL: string, connection: Connection, encryption?: EncryptionMethod, headers: CodecHeaders = {}) => new Promise(async resolve => {
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
  }),

  recordPlaylist: (log: Logger, fileID: string, playlistURL: string, startTime: DateTime, endTime: DateTime, connection: Connection, headers: CodecHeaders = {}) => new Promise(async (resolve, reject) => {
    const VIDEO_PATH = path.join(__dirname, `../../output/${ fileID }.mp4`)

    let isComplete = false
    const ffmpeg = Ffmpeg(playlistURL)
                    .withAudioCodec("copy")
                    .withVideoCodec("copy")
                    .on('error', function(err) {
                      log('[ffmpeg]: Error: ' + err.message);
                    })
                    .on('stderr', (stderrLine: string) => {
                      log('[ffmpeg]: ' + stderrLine);
                      if (stderrLine.indexOf("Exiting normally") !== -1) {
                        if (!isComplete) {
                          log("Record complete!")
                          isComplete = true
                          resolve(VIDEO_PATH)
                        }
                      }
                    })
                    .on('end', function() {
                      log('Finished processing')
                      if (!isComplete) {
                        isComplete = true
                        resolve(VIDEO_PATH)
                      }
                    })
                    .save(VIDEO_PATH)
                    
    const duration = endTime.diff(startTime)
    log(`Record duration: ${ duration.toISO() }`)
    setTimeout(() => {
      log(`Stopping at ${ DateTime.local() }`)
      ffmpeg.kill("SIGTERM")
    }, duration.milliseconds)
  })

}