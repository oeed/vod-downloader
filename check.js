const fetch = require("node-fetch")
const fs = require("fs")
const download = require("./download")
const { DateTime } = require("luxon")
const path = require("path")
const mv = require('mv')
const { spawn, exec } = require('child_process');

const EPISODES_PATH = path.join(__dirname, "episodes.json")
const existingEpisodes = fs.existsSync(EPISODES_PATH) ? JSON.parse(fs.readFileSync(EPISODES_PATH, "utf-8")) : {}
const saveEpisodes = () => fs.writeFileSync(EPISODES_PATH, JSON.stringify(existingEpisodes))

existingEpisodes.hybpa = existingEpisodes.hybpa || {}

process.on ('exit', code => {
  exec(`sh ${ path.join(__dirname, "stop-proxy.sh") }`)
});

async function checkShow(id, url, folderName, formatFileName) {
  console.log("Checking show:", id)
  existingEpisodes[id] = existingEpisodes[id] || {}
  await fetch(url).then(response => response.text()).then(async page => {
    const pageData = page.match(/<script>const\s+showPageData\s*=\s*(\{.+\})\;<\/script>/)
    if (pageData) {
      const show = JSON.parse(pageData[1])
      const latestVideo = show.video.videoId
      if (!existingEpisodes[id][latestVideo]) {
        console.log("New episode!", show.video.title, latestVideo)
        const tempPath = await download(latestVideo)
        const [_, seasonNo, episodeNo] = show.video.title.match(/S.*?(\d+) E.*?(\d+)/)
        const fileName = formatFileName(show.video, episodeNo, seasonNo)
        const destPath = `/media/plex/tv/${ folderName }/Season ${ seasonNo }/${ fileName }`
        mv(tempPath, destPath, err => {
          if (err) { throw err }
          existingEpisodes[id][latestVideo] = true
          saveEpisodes()
          console.log("Moved episode to", `/media/plex/tv/${ folderName }/${ fileName }`)
          exec(`sh ${ path.join(__dirname, "stop-proxy.sh") }`)
        })
      }
      else {
        console.log("No new episode, latest: ", show.video.title)
      }
    }
  })
  
}

checkShow("hybpa", "https://10play.com.au/have-you-been-paying-attention", "Have You Been Paying Attention!", (video, episodeNo) => `Have You Been Paying Attention! - ${ DateTime.fromISO(video.airDate).toISODate() } - Episode ${ episodeNo }.mkv`)
checkShow("bachelorette", "https://10play.com.au/the-bachelorette", "The Bachelorette Australia", (video, episodeNo, seasonNo) => `The Bachelorette Australia - ${ seasonNo }x0${ episodeNo } - Episode ${ episodeNo }.mkv`)