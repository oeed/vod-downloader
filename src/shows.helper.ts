import { EPGEpisode } from 'epg.helper';
import * as fs from 'fs';
import { DateTime } from "luxon";
import * as path from "path";
import { getPlatform, isLivePlatform, isOnDemandPlatform, LivePlatform, OnDemandPlatform, Platform } from "platform.types";

export enum OrdinalityType {
  numerical = "numerical",
  seasonedDate = "seasonedDate",
  date = "date"
}

interface SerialisedShow {

  id: string
  name: string
  platformID: string
  mostRecentOnly?: boolean
  checkPath: string
  ordinality: OrdinalityType
  library?: string // i.e. tv/news
  channelID?: string

}

export interface Show<P extends Platform> {

  id: string
  name: string
  platform: P
  mostRecentOnly?: boolean
  checkPath: string
  ordinality: OrdinalityType
  library?: string // i.e. tv/news
  channelID?: string

}

const serialiseShow = (show: Show<any>): SerialisedShow => ({
  id: show.id,
  name: show.name,
  platformID: show.platform.id,
  mostRecentOnly: show.mostRecentOnly,
  checkPath: show.checkPath,
  ordinality: show.ordinality,
  library: show.library,
})

const unserialiseShow = (show: SerialisedShow): Show<any> => ({
  id: show.id,
  name: show.name,
  platform: getPlatform(show.platformID),
  mostRecentOnly: show.mostRecentOnly,
  checkPath: show.checkPath,
  channelID: show.channelID,
  ordinality: show.ordinality,
  library: show.library,
})

export type EpisodeOrdinality = {
  season: number
  episode: number  
} | {
  season: number
  airDate: DateTime
} | {
  airDate: DateTime
}

export const ordinalityDescription = (ordinality: EpisodeOrdinality) => {
  if ("airDate" in ordinality && "season" in ordinality) {
    return `S${ ordinality.season } @ ${ ordinality.airDate.toISODate() }`
  }
  else if ("airDate" in ordinality) {
    return `S1 @ ${ ordinality.airDate.toISODate() }`
  }
  else {
    return `S${ ordinality.season }, E${ ordinality.episode }`
  }
}

export interface Episode<P extends Platform = Platform> {

  id: string // the ID specific to the platform
  show: Show<P>
  platform: P

  ordinality: EpisodeOrdinality

}

export interface OnDemandEpisode extends Episode<OnDemandPlatform> {}

export interface LiveEpisode extends Episode<LivePlatform> {

  epgEpisode: EPGEpisode

}

export const formatShowPath = (show: Show<any>) => {
  return `${ process.env.MEDIA_PATH }${ show.library || "tv" }/${ show.name }/`
}

export const formatEpisodePath = (episode: Episode) => {
  const { ordinality } = episode
  let ordinalitySuffix: string
  let season = "season" in ordinality ? ordinality.season : 1
  if ("airDate" in ordinality) {
    ordinalitySuffix = ordinality.airDate.toISODate()
  }
  else {
    ordinalitySuffix = `${ ordinality.season }x${ ordinality.episode.toFixed(0).padStart(2, "0") } - Episode ${ ordinality.episode }`
  }

  return `${ formatShowPath(episode.show) }Season ${ season }/${ episode.show.name } - ${ ordinalitySuffix }.mkv`
}

const SHOWS_PATH = path.join(__dirname, "../shows.json")
let shows: Show<any>[]
export const loadShows = () => {
  if (!fs.existsSync(SHOWS_PATH)) {
    throw new Error("No shows file")
  }

  const serialised: SerialisedShow[] = JSON.parse(fs.readFileSync(SHOWS_PATH, "utf-8"))
  shows = serialised.map(show => unserialiseShow(show))
}

export const getShows = () => shows
export const getLiveShows = (): Show<LivePlatform>[] => shows.filter(show => isLivePlatform(show.platform))
export const getOnDemandShows = (): Show<OnDemandPlatform>[] => shows.filter(show => isOnDemandPlatform(show.platform))