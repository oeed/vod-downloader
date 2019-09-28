const fetch = require("node-fetch")
const fs = require("fs")
const download = require("./download")
const { DateTime } = require("luxon")

const EPISODES_PATH = "episodes.json"
const existingEpisodes = fs.existsSync(EPISODES_PATH) ? JSON.parse(fs.readFileSync(EPISODES_PATH, "utf-8")) : {}
const saveEpisodes = () => fs.writeFileSync(EPISODES_PATH, JSON.stringify(existingEpisodes))

existingEpisodes.hybpa = existingEpisodes.hybpa || {}

fetch("https://10play.com.au/have-you-been-paying-attention").then(response => response.text()).then(async page => {
  const pageData = page.match(/<script>const\s+showPageData\s*=\s*(\{.+\})\;<\/script>/)
  if (pageData) {
    const show = JSON.parse(pageData[1])
    const latestVideo = show.video.videoId
    if (!existingEpisodes.hybpa[latestVideo]) {
      console.log("New episode!", show.video.title, latestVideo)
      const tempPath = await download(latestVideo)
      const [_, seasonNo, episodeNo] = show.video.title.match(/S.*?(\d+) E.*?(\d+)/)
      const fileName = `Have You Been Paying Attention! - ${ DateTime.fromISO(show.video.airDate).toISODate() } - Episode ${ episodeNo }`
      const path = `/media/plex/Have You Been Paying Attention!/Season ${ seasonNo }/${ fileName }`
      fs.rename(tempPath, path)
      existingEpisodes.hybpa[latestVideo] = true
      saveEpisodes()
      console.log("Move episode to", `/media/plex/tv/Have You Been Paying Attention!/${ fileName }`)
    }
    else {
      console.log("No new episode, latest: ", show.video.title)
    }
  }
})