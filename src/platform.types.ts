import { CodecResult } from "codec.types";
import { Connection } from "proxy";
import { Episode, Show } from "shows.types";

export interface Platform {

  id: string
  name: string
  needsProxy: boolean
  downloadEpisode: (fileID: string, episode: Episode, connection: Connection) => Promise<CodecResult>
  checkShow: (show: Show) => Promise<Episode> // the latest episode

}

const platforms: { [platformID: string]: Platform } = {}
export const getPlatform = (platformID: string) => {
  if (platformID in platforms) {
    return platforms[platformID]
  }
  throw new Error(`Platform not found: ${ platformID }`)
}
export const registerPlatforms = (_platforms: Platform[]) => {
  for (const platform of _platforms) {
    platforms[platform.id] = platform
  }
}
