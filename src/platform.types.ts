import { CodecResult } from "codec.types";
import { EPG, EPGEpisode } from "epg.helper";
import { Logger } from "log.helper";
import { Connection } from "proxy";
import { Episode, Show } from "shows.helper";

export interface Platform {

  id: string
  name: string
  needsProxy: boolean

}

export interface OnDemandPlatform extends Platform {

  downloadEpisode: (log: Logger, fileID: string, episode: Episode<OnDemandPlatform>, connection: Connection) => Promise<CodecResult>
  checkShow: (log: Logger, show: Show<OnDemandPlatform>) => Promise<Episode<OnDemandPlatform>> // the latest episode

}

export interface LivePlatform extends Platform {

  epg?: EPG
  recordEpisode: (log: Logger, fileID: string, episode: Episode<LivePlatform>, epgEpisode: EPGEpisode, connection: Connection) => Promise<CodecResult>
  refreshEPG: (log: Logger, connection: Connection) => Promise<EPG>

}

export const isLivePlatform = (platform: Platform): platform is LivePlatform => "refreshEPG" in platform
export const isOnDemandPlatform = (platform: Platform): platform is OnDemandPlatform => "checkShow" in platform

export const livePlatforms: LivePlatform[] = []
const platforms = new Map<string, Platform>()
export const getPlatform = (platformID: string) => {
  const platform = platforms.get(platformID)
  if (platform) {
    return platform
  }
  throw new Error(`Platform not found: ${ platformID }`)
}
export const getLivePlatform = (platformID: string) => {
  const platform = getPlatform(platformID)
  if (isLivePlatform(platform)) {
    return platform as LivePlatform
  }
  throw new Error(`Platform not found/live: ${ platformID }`)
}
export const getOnDemandPlatform = (platformID: string) => {
  const platform = getPlatform(platformID)
  if (isOnDemandPlatform(platform)) {
    return platform as OnDemandPlatform
  }
  throw new Error(`Platform not found/on demand: ${ platformID }`)
}
export const registerPlatforms = (_platforms: Platform[]) => {
  for (const platform of _platforms) {
    platforms.set(platform.id, platform)
    if (isLivePlatform(platform)) {
      livePlatforms.push(platform)
    }
  }
}
