import { getPlatformLogger, getShowLogger } from "log.helper";
import { LivePlatform, livePlatforms } from "platform.types";
import { localConnection } from "proxy";
import { recordEpisode } from "record.helper";
import { Episode, getLiveShows, Show } from "shows.helper";

const showTimers = new Map<Show<LivePlatform>, NodeJS.Timeout>()

export const checkAllLiveShows = async () => {
  for (const platform of livePlatforms) {
    const log = getPlatformLogger(platform)
    const epg = await platform.refreshEPG(getPlatformLogger(platform), localConnection())
    const shows = getLiveShows().filter(show => show.platform === platform)
      
    for (const show of shows) {
      const { channelID } = show
      if (!channelID) {
        throw new Error(`No channelID for show: ${ show.id }`)
      }
    
      const epgChannel = epg.channels.get(channelID)
      if (!epgChannel) {
        throw new Error(`No EPG channel with channelID: ${channelID } for show: ${ show.id }`)
      }

      const epgShow = epgChannel.shows.get(show.checkPath)
      if (epgShow) {
        const existingTimer = showTimers.get(show)
        if (existingTimer) {
          clearTimeout(existingTimer)
        }

        const { nextEpisode } = epgShow
        if (nextEpisode) {
          const episode: Episode<LivePlatform> = {
            id: nextEpisode.startDate.toMillis().toFixed(0),
            show,
            platform,
            ordinality: {
              airDate: nextEpisode.startDate
            }
          }
          
          const deltaMS = nextEpisode.startDate.diffNow("milliseconds").milliseconds
          log(`Schedule recording of ${ show.name } at ${ nextEpisode.startDate.toISO() }, in ${ deltaMS }ms`)
          
          const showLog = getShowLogger(show)
          showTimers.set(show, setTimeout(() => recordEpisode(showLog, episode, nextEpisode), deltaMS))
        }
      }
    }
    
  }
}