import { M3U8 } from "codecs/m3u8.codec";
import { DateTime } from "luxon";
import fetch from "node-fetch";
import { OnDemandPlatform } from "platform.types";
import { Episode, EpisodeOrdinality } from "shows.helper";
import { parseStringPromise } from "xml2js";

interface EpisodeInformation {
  rows: {
    feeds: {
      data: {
        id: string,
        media$availableDate: number
      }[]
    }[]
  }[]
}

interface VideoInformation {
  releaseUrls: {
    html: string
  }
}

interface OptionsInformation {
  smil: {
    body: {
      seq: {
        video?: {
          $: {
            src: string
          }
        }[]
        par?: {
          video: {
            $: {
              src: string
            }
          }[]
        }[]
      }[]
    }[]
  }
}

export const SBS: OnDemandPlatform = {

  id: "sbs",
  name: "SBS",
  needsProxy: true,
  
  async downloadEpisode(log, fileID, episode, connection) {
    log("Get video details...")
    const { body: videoBody } = await connection.get(`https://www.sbs.com.au/api/video_pdkvars/playlist/${ episode.id }`)
    const video: VideoInformation[] = JSON.parse(videoBody)
    const optionsURL = video[0].releaseUrls.html
    
    const { body: optionsBody } = await connection.get(optionsURL)
    const options: OptionsInformation = await parseStringPromise(optionsBody)

    const sequence = options.smil.body[0].seq[0]
    let source: string
    if (sequence.par) {
      source = sequence.par[0].video[0].$.src
    }
    else if (sequence.video){
      source = sequence.video[0].$.src
    }
    else {
      throw new Error(`Unsure how to read SBS options for ${ episode.show.id }`)
    }
    return M3U8.downloadPlaylist(log, fileID, source, connection)
  },

  async checkShow(log, show) {
    const response: EpisodeInformation  = await fetch(`https://www.sbs.com.au/api/video_program?context=web2&id=${ show.checkPath }`).then(response => response.json())
    const info = response.rows[0].feeds[0].data[0]
    const date = DateTime.fromMillis(info.media$availableDate, { zone: "Australia/Sydney" })
    const idMatch = /\d+$/.exec(info.id)
    if (!idMatch) {
      throw new Error(`Could not match ID: ${ show.checkPath }`)
    }
    
    let ordinality: EpisodeOrdinality = {
      airDate: date
    }

    const episode: Episode<OnDemandPlatform> = {
      id: idMatch[0],
      show,
      platform: this,
      ordinality
    }

    return episode
  }

}