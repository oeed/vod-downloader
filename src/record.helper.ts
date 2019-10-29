
import { EPGEpisode } from 'epg.helper';
import { Logger } from 'log.helper';
import { LivePlatform } from 'platform.types';
import { Episode } from "shows.helper";
import { saveCodecResult } from 'video.helper';
import { connectProxy, localConnection } from "./proxy";

export const recordEpisode = (log: Logger, episode: Episode<LivePlatform>, epgEpisode: EPGEpisode) => new Promise(async () => {
  const connection = episode.platform.needsProxy ? await connectProxy() : localConnection()
  
  const fileID = `${ episode.show.id }-${ episode.id }`
  const result = await episode.platform.recordEpisode(log, fileID, episode, epgEpisode, connection)

  return saveCodecResult(log, fileID, episode, result)
})