const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const m3u8stream = require('m3u8stream')
const miniget = require("miniget")
const http = require("http")
const { URL } = require('url');
const m3u8 = require('m3u8');
const stringStream = require('string-to-stream')

const PROXY_HOST = '127.0.0.1'
const PROXY_PORT = 8887

const proxyOptions = {
  transform: (parsed) => {
    delete parsed.hostname
    parsed.host = PROXY_HOST
    parsed.port = PROXY_PORT
    parsed.path = parsed.href
    parsed.protocol = "http:"
    if (parsed.headers) {
      const url = new URL(parsed.href)
      parsed.headers.host = url.host
    }
    return parsed
  }
}

const get = (url, headers, callback) => miniget(url, Object.assign({ headers }, proxyOptions), callback)

const determineRenditionKey = (url) => new Promise(resolve => {
  get(url, {},(err, res, videoRendition) => {
    const segmentCount = (videoRendition.match(/#EXTINF:/g)||[]).length
    const [_, keyUrl, ivStr] = videoRendition.substr(0, 1000).match(/URI="([^\"]+)",IV=0x([0-9a-fA-F]+)/)
    const iv = Buffer.from(ivStr, "hex")
    const url = new URL(keyUrl)
    http.get({ host: PROXY_HOST, port: PROXY_PORT, path: keyUrl, headers: { host: url.host } }, res => {
      const data = [];
      res.on('data', function(chunk) {
        data.push(chunk);
      }).on('end', function() {
          const key = Buffer.concat(data);
          resolve({ key, iv, segmentCount })
      });
    })
  })
})

const downloadStream = (url, fileName) => new Promise(async (resolve, reject) => {
  const { key, iv, segmentCount } = await determineRenditionKey(url)
  const stream = m3u8stream(url, { parser: "m3u8", requestOptions: Object.assign({ headers: {} }, proxyOptions) })

  stream.on("error", (err) => {
    reject(err)
    stream.end()
  })
  let chunks = []
  stream.on('readable', () => {
    const buffer = stream.read()
    if (buffer !== null) {
      chunks.push(buffer)
    }
  })

  let i = 4
  const file = fs.createWriteStream(fileName)
  stream.on("progress", (data) => {
    i --
    if (i <= 0) {
      file.end()
      stream.end()
      return
    }
    console.log(`${ fileName }: Segment done: ${ data.num }/${ segmentCount } ${ (data.num / segmentCount * 100).toFixed(1) }%`, data)
    let decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    let decrypted = decipher.update(Buffer.concat(chunks));
    chunks = []
    file.write(decrypted)
  })
  stream.on("end", () => {
    file.end()
    resolve()
  })
})

console.log("Get video details...")
get("https://edge.api.brightcove.com/playback/v1/accounts/2199827728001/videos/6088675631001", { "Accept": "application/json;pk=BCpkADawqM3LrTsmy4tDkB6PwE5QiKnkQF0gsdyOVDmJNyCmpHG8FbEekN-V2-y5KmH5nyVJ-8HVv9rMX37nUed-zfUhOFiHwA3XhW35sjvr_qk92T8f2dbdA9vLN-wzvdaChZeUqcj3wQOf" }, (err, res, videoBody) => {
  if (err) { throw new Error(err) }
  const video = JSON.parse(videoBody)
  const source = video.sources[0]
  console.log("Get manifest...")
  get(source.src, { "Accept": "application/json;pk=BCpkADawqM3LrTsmy4tDkB6PwE5QiKnkQF0gsdyOVDmJNyCmpHG8FbEekN-V2-y5KmH5nyVJ-8HVv9rMX37nUed-zfUhOFiHwA3XhW35sjvr_qk92T8f2dbdA9vLN-wzvdaChZeUqcj3wQOf" }, (err, res, manifest) => {
    if (err) { throw new Error(err) }
    var parser = m3u8.createStream();
    stringStream(manifest).pipe(parser)
    parser.on('m3u', async function(m3u) {
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

      if (!fs.existsSync("output")){
        fs.mkdirSync("output");
      }

      console.log("Get audio...")
      await downloadStream(audio.attributes.attributes.uri, "output/audio.m4a")
      console.log("Get video...")
      await downloadStream(video.properties.uri, "output/video.mp4")
      
      console.log("Merging audio and video...")
      exec('ffmpeg -i output/video.mp4 -i output/audio.m4a -c copy output/output.mkv');
    });
  })
})