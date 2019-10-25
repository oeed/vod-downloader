import { M3U8 } from "codecs/m3u8.codec";
import RenditionEncryption from "encryptions/rendition.encryption";
import { DateTime } from "luxon";
import fetch from "node-fetch";
import { Platform } from "platform.types";
import { Episode, EpisodeOrdinality, OrdinalityType } from "shows.types";

const privateKey = "BCpkADawqM2-Pw-g3-psbmh7mEsKhBVp1QRsKxK5tBOpF72ud6VrAndDsRbs2jlmlgSRJiPdNjJOJESytpUUmyb-Muz41HVYcPcoEdG2E8xmHgcwy7frHjTwbJqTXo2Sxmhjgw2Nynprcv7c"
const privateKeyHeader = { "Accept": `application/json;pk=${ privateKey }` }

interface EpisodeInformation { 
  show: { 
    // images:{ 
    //   dashboardHero:"https://cdn.mediaworks.nz/3now/shows/122217/1564529502029_newshub_hero_dashboard_3200x1040_app_v1_updated.png?width=[width]&height=[height]&crop=auto",
    //   showHero:"https://cdn.mediaworks.nz/3now/shows/122217/1564529501453_newshub_hero_dashboard_3200x1040_app_v1_updated.png?width=[width]&height=[height]&crop=auto",
    //   showHeroSecondary:"https://cdn.mediaworks.nz/3now/shows/122217/1564529500303_newshub_hero_showpage_1884x990_app_updated.png?width=[width]&height=[height]&crop=auto",
    //   showTile:"https://cdn.mediaworks.nz/3now/shows/122217/1564529500853_newshub_showtile_768x576_app_updated.png?width=[width]&height=[height]&crop=auto",
    //   squareHero:"https://cdn.mediaworks.nz/3now/shows/122217/1564529499607_newshub_hero(mobile)_1200x1200_app_updated.png?width=[width]&height=[height]&crop=auto"
    // },
    episodes: { 
      name: string,
      episode: number | null,
      season: number | null,
      externalMediaId: string // "6097255119001",
      airedDate: string // "2019-10-24T18:00:00+13:00",
      videoRenditions:{ 
        once:{ 
          url:"https://now-api4-prod.mediaworks.nz/v4/playback/6097255119001/dash/ssai_ssab_csa/vmap",
          brightcoveId:"6097255119001",
          ad_config_id:"e2a40fe3-0513-4e64-b398-44518ae61937",
          ad_model:"ssai_ssab_csa"
        }
        // videoCloud:{ 
        //   brightcoveId: string / "6097255119001"
        // }
      }
    }[]
  }
}

interface VideoInformation {
  sources: {
    ext_x_version: "4"
    src: string // "http://ssaiplayback.prod.boltdns.net/playback/once/v1/hls/v4/clear/3812193411001/e2a40fe3-0513-4e64-b398-44518ae61937/49669cb8-eadf-4aa1-8a25-db93099d9a31/master.m3u8?bc_token=NWRiM2NmM2JfZWNhMDE3MzBkODgwODg2NzZkMjc2MGNhYzlhMjVjNDFlNzUxMDY1YzNiODJkMDRiOTZiYjZjNmEwZDcyYmJkZg%3D%3D"
    type: string // "application/x-mpegURL"
  }[]
}

export const ThreeNow: Platform = {

  id: "threenow",
  name: "Three Now",
  needsProxy: false,
  
  async downloadEpisode(log, fileID, episode, connection) {
    log("Get video details...")
    const { body: videoBody } = await connection.get(`https://edge.api.brightcove.com/playback/v1/accounts/2199827728001/videos/${ episode.id }`, { "Accept": "application/json;pk=BCpkADawqM3LrTsmy4tDkB6PwE5QiKnkQF0gsdyOVDmJNyCmpHG8FbEekN-V2-y5KmH5nyVJ-8HVv9rMX37nUed-zfUhOFiHwA3XhW35sjvr_qk92T8f2dbdA9vLN-wzvdaChZeUqcj3wQOf" })
    
    const video = JSON.parse(videoBody)
    const source: string = video.sources[0].src
    return M3U8.downloadPlaylist(log, fileID, source, connection, new RenditionEncryption(), { "Accept": "application/json;pk=BCpkADawqM3LrTsmy4tDkB6PwE5QiKnkQF0gsdyOVDmJNyCmpHG8FbEekN-V2-y5KmH5nyVJ-8HVv9rMX37nUed-zfUhOFiHwA3XhW35sjvr_qk92T8f2dbdA9vLN-wzvdaChZeUqcj3wQOf" })
  },

  async checkShow(log, show) {
    const episodeInfo: EpisodeInformation = await fetch(`https://now-api4-prod.mediaworks.nz/v4/shows/${ show.checkPath }`).then(r => r.json())
    
    const episodeID = episodeInfo.show.episodes[0].externalMediaId

    const videoInfo: VideoInformation = await fetch(`https://edge.api.brightcove.com/playback/v1/accounts/3812193411001/videos/${  }?ad_config_id=e2a40fe3-0513-4e64-b398-44518ae61937`, { headers: privateKeyHeader })


    const page = await fetch(`https://10play.com.au/${ show.checkPath }`).then(response => response.text())
    const pageData = page.match(/<script>const\s+showPageData\s*=\s*(\{.+\})\;<\/script>/)
    if (!pageData) {
      throw new Error(`Could not parse page: ${ show.checkPath }`)
    }
    const video: VideoInformation = JSON.parse(pageData[1]).video

    const titleMatch = video.title.match(/S.*?(\d+) E.*?(\d+)/)
    if (!titleMatch) {
      throw new Error(`Could not match title '${ video.title }' for ${ show.id }`)
    }
    let ordinality: EpisodeOrdinality
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

    const episode: Episode = {
      id: video.videoId,
      show: show,
      platform: this,
      ordinality
    }

    return episode
  }

}