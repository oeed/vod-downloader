
import { Logger } from 'log.helper';
import { OnDemandPlatform } from 'platform.types';
import { Episode } from "shows.helper";
import { saveCodecResult } from 'video.helper';
import { connectProxy, localConnection } from "./proxy";

export const downloadEpisode = (log: Logger, episode: Episode<OnDemandPlatform>) => new Promise(async (resolve, reject) => {
  const connection = episode.platform.needsProxy ? await connectProxy() : localConnection()
  
  const fileID = `${ episode.show.id }-${ episode.id }`
  const result = await episode.platform.downloadEpisode(log, fileID, episode, connection)

  return saveCodecResult(log, fileID, episode, result)
})