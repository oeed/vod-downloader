import { M3U8 } from "codecs/m3u8.codec";
import { fetchEPG } from "epg.helper";
import { LivePlatform } from "platform.types";
import { Connection } from "proxy";

const channelMapping = new Map<string, string>()

const updateChannelMapping = async (connection: Connection) => {
  const { body: manifest} = await connection.get("http://i.mjh.nz/nzau/kodi.m3u8")

  const regex = /#EXTINF:-1 tvg-id="([^\"]+)".+\n(http[^|]+)/g
  let match
  while ((match = regex.exec(manifest)) != null) {
    channelMapping.set(match[1], match[2])
  }
}

export const Freeview: LivePlatform = {

  id: "freeview",
  name: "Freeview",
  needsProxy: false,
  
  async recordEpisode(log, fileID, episode, epgEpisode, connection) {
    const url = channelMapping.get(epgEpisode.show.channel.id)
    if (!url) {
      throw new Error(`No URL for ${ epgEpisode.show.channel.id }`)
    }
    return M3U8.recordPlaylist(log, fileID, url, epgEpisode.startDate, epgEpisode.endDate, connection)
  },

  async refreshEPG(log, connection) {
    // update our chann
    await updateChannelMapping(connection)
    return fetchEPG("http://i.mjh.nz/nzau/epg.xml", connection)
  }

}
