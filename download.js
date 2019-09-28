const { exec, spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const m3u8stream = require('m3u8stream')
const miniget = require("miniget")
const https = require("https")
const SocksProxyAgent = require('socks-proxy-agent');
const { URL, parse: parseURL } = require('url');
const m3u8 = require('m3u8');
const path = require("path")
const stringStream = require('string-to-stream')
const { spawn, exec } = require('child_process');

const connectProxy = () => new Promise((resolve, reject) => {
  let hasResolved = false
  console.log("Connecting proxy...")
  const proxyProcess = spawn("sh", [path.join(__dirname, "proxy.sh")])
  proxyProcess.stdout.setEncoding('utf8');
  proxyProcess.stderr.setEncoding('utf8');

  const onData = data => {
    if (!hasResolved) {
      console.log(data)
    }
    if (!hasResolved && data.indexOf("Local forwarding listening on 127.0.0.1 port 2001") !== -1) {
      console.log("Proxy connected")
      hasResolved = true
      resolve(proxyProcess)
    }
  }
  proxyProcess.stdout.on('data', onData)
  proxyProcess.stderr.on('data', onData)
  

  setTimeout(() => {
    if (!hasResolved) {
      exec(`sh ${ path.join(__dirname, "stop-proxy.sh") }`)
      reject("Proxy timeout")
      hasResolved = true
    }
  }, 120000)

})

module.exports = (episodeID) => new Promise(async resolvePath => {
  const proxyProcess = await connectProxy()
  const proxy = process.env.PROXY || 'socks://127.0.0.1:2001';
  const agent = new SocksProxyAgent(proxy)

  const proxyOptions = {
    transform: (parsed) => {
      const opts = parseURL(parsed.href);
      opts.agent = agent
      opts.headers = parsed.headers
      return opts
    }
  }

  const get = (url, headers, callback) => miniget(url, Object.assign({ headers }, proxyOptions), callback)

  const determineRenditionKey = (url) => new Promise(resolve => {
    get(url, {},(err, res, videoRendition) => {
      const segmentCount = (videoRendition.match(/#EXTINF:/g)||[]).length
      const [_, keyUrl, ivStr] = videoRendition.substr(0, 1000).match(/URI="([^\"]+)",IV=0x([0-9a-fA-F]+)/)
      const iv = Buffer.from(ivStr, "hex")
      https.get(proxyOptions.transform({ href: keyUrl, headers: {} }), res => {
        const data = [];
        res.on('data', function(chunk) {
          data.push(chunk);
        }).on('end', function()  {
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

    const file = fs.createWriteStream(fileName)
    stream.on("progress", (data) => {
      console.log(`${ fileName }: Segment done: ${ data.num }/${ segmentCount } ${ (data.num / segmentCount * 100).toFixed(1) }%`)
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
  get(`https://edge.api.brightcove.com/playback/v1/accounts/2199827728001/videos/${ episodeID }`, { "Accept": "application/json;pk=BCpkADawqM3LrTsmy4tDkB6PwE5QiKnkQF0gsdyOVDmJNyCmpHG8FbEekN-V2-y5KmH5nyVJ-8HVv9rMX37nUed-zfUhOFiHwA3XhW35sjvr_qk92T8f2dbdA9vLN-wzvdaChZeUqcj3wQOf" }, (err, res, videoBody) => {
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

        if (!fs.existsSync(path.join(__dirname, "output"))){
          fs.mkdirSync(path.join(__dirname, "output"));
        }

        console.log("Get audio...")
        const AUDIO_PATH = path.join(__dirname, `output/${ episodeID }.m4a`)
        const VIDEO_PATH = path.join(__dirname, `output/${ episodeID }.mp4`)
        const OUTPUT_PATH = path.join(__dirname, `output/${ episodeID }.mkv`)
        await downloadStream(audio.attributes.attributes.uri, AUDIO_PATH)
        console.log("Get video...")
        await downloadStream(video.properties.uri, VIDEO_PATH)
        proxyProcess.kill()
        exec(`sh ${ path.join(__dirname, "stop-proxy.sh") }`)
        
        console.log("Merging audio and video...")
        if (fs.existsSync(OUTPUT_PATH)) {
          fs.unlinkSync(OUTPUT_PATH)
        }
        exec(`ffmpeg -i ${ VIDEO_PATH } -i ${ AUDIO_PATH } -c copy ${ OUTPUT_PATH }`, () => {
          console.log("done")
          fs.unlinkSync(AUDIO_PATH)
          fs.unlinkSync(VIDEO_PATH)
          resolvePath(OUTPUT_PATH)
        });
      });
    })
  })
})