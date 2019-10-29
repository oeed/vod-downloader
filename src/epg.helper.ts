import { DateTime } from "luxon";
import { Connection } from "proxy";
import { parseStringPromise } from "xml2js";

interface EPGResponse {
  tv: {
    channel: {
      $: {
        id: string
      },
      "display-name": string[], // TVNZ 1, 1 TVNZ 1, 1
      icon: {
        $: {
          src: string // url
        }
      },
      lcn: string[] // local channel number
    }[],
    programme: {
      $: {
        channel: string, // url ID
        start: string, // "20191025210557 +0000"
        stop: string, // "20191025210557 +0000"
      },
      desc?: string,
      subtitle?: string[],
      title: string[]
    }[]
  }
}

export interface EPG {
  channels: Map<string, EPGChannel> // id: channel
  channelNames: Map<string, string> // name: id
}

export interface EPGChannel {
  id: string
  name: string
  shows: Map<string, EPGShow>
}

export interface EPGShow {
  channel: EPGChannel
  name: string
  nextEpisode?: EPGEpisode
}

export interface EPGEpisode {
  show: EPGShow
  startDate: DateTime
  endDate: DateTime
}

export const epgShowKey = (show: EPGShow) => `${ show.channel.id }:${ show.name }`

export const fetchEPG = async (url: string, connection: Connection) => {
  const { body } = await connection.get(url)
  const { tv: response }: EPGResponse = await parseStringPromise(body)
  
  const channels = new Map<string, EPGChannel>()
  const channelNames = new Map<string, string>()

  for (const channelResponse of response.channel) {
    if (channelResponse["display-name"]) {
      const channel: EPGChannel = {
        id: channelResponse.$.id,
        name: channelResponse["display-name"][0],
        shows: new Map()
      }

      channelNames.set(channel.name, channel.id)
      channels.set(channel.id, channel)
    }
  }

  for (const episodeResponse of response.programme) {
    const { title: [ name ], $: { channel: channelID, start, stop } } = episodeResponse
    const channel = channels.get(episodeResponse.$.channel)
    if (!channel) { continue }

    const startDate = DateTime.fromFormat(start, "yyyyMMddHHmmss ZZZ")
    if (startDate.diffNow("milliseconds").milliseconds < 0) { continue }


    if (!channel.shows.has(name)) {
      // ASSUMPTION: the first episode is always listed first
      const endDate = DateTime.fromFormat(stop, "yyyyMMddHHmmss ZZZ")
      const show: EPGShow = {
        channel,
        name
      }
      show.nextEpisode = {
        startDate, 
        endDate,
        show
      }
      channel.shows.set(name, show)
    }
  }

  const epg: EPG = {
    channels,
    channelNames
  }
  
  return epg
}