import { M3U8 } from "codecs/m3u8.codec";
import RenditionEncryption from "encryptions/rendition.encryption";
import { DateTime } from "luxon";
import fetch from "node-fetch";
import { OnDemandPlatform } from "platform.types";
import { Episode, EpisodeOrdinality, OrdinalityType } from "shows.helper";

interface VideoInformation {
  title: string
  videoId: string
  airDate: string
}

export const TenPlay: OnDemandPlatform = {

  id: "tenplay",
  name: "Ten Play",
  needsProxy: true,
  
  async downloadEpisode(log, fileID, episode, connection) {
    log("Get video details...")
    const { body: videoBody } = await connection.get(`https://edge.api.brightcove.com/playback/v1/accounts/2199827728001/videos/${ episode.id }`, { "Accept": "application/json;pk=BCpkADawqM3LrTsmy4tDkB6PwE5QiKnkQF0gsdyOVDmJNyCmpHG8FbEekN-V2-y5KmH5nyVJ-8HVv9rMX37nUed-zfUhOFiHwA3XhW35sjvr_qk92T8f2dbdA9vLN-wzvdaChZeUqcj3wQOf" })
    
    const video = JSON.parse(videoBody)
    const source: string = video.sources[0].src
    return M3U8.downloadPlaylist(log, fileID, source, connection, new RenditionEncryption(), { "Accept": "application/json;pk=BCpkADawqM3LrTsmy4tDkB6PwE5QiKnkQF0gsdyOVDmJNyCmpHG8FbEekN-V2-y5KmH5nyVJ-8HVv9rMX37nUed-zfUhOFiHwA3XhW35sjvr_qk92T8f2dbdA9vLN-wzvdaChZeUqcj3wQOf" })
  },

  async checkShow(log, show) {
    const page = await fetch(`https://10play.com.au/${ show.checkPath }`).then(response => response.text())
    const pageData = page.match(/<script>const\s+showPageData\s*=\s*(\{.+\})\;<\/script>/)
    if (!pageData) {
      throw new Error(`Could not parse page: ${ show.checkPath }`)
    }
    const video: VideoInformation = JSON.parse(pageData[1]).video

    let ordinality: EpisodeOrdinality
    if (show.ordinality === OrdinalityType.date) {
      ordinality = {
        airDate: DateTime.fromISO(video.airDate)
      }      
    }
    else {
      const titleMatch = video.title.match(/S.*?(\d+) E.*?(\d+)/)
      if (!titleMatch) {
        throw new Error(`Could not match title '${ video.title }' for ${ show.id }`)
      }
      const [_, seasonNo, episodeNo] = titleMatch
      if (show.ordinality === OrdinalityType.numerical) {
        ordinality = {
          season: parseInt(seasonNo),
          episode: parseInt(episodeNo)
        }
      }
      else {
        ordinality = {
          season: parseInt(seasonNo),
          airDate: DateTime.fromISO(video.airDate)
        }
      }
    }

    const episode: Episode<OnDemandPlatform> = {
      id: video.videoId,
      show: show,
      platform: this,
      ordinality
    }

    return episode
  }

}