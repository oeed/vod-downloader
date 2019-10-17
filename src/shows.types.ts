import { DateTime } from "luxon";
import { Platform } from "platform.types";

export enum OrdinalityType {
  numerical = "numerical",
  date = "date"
}

export interface Show {

  id: string
  name: string
  platformID: string
  mostRecentOnly?: boolean
  checkPath: string
  ordinality: OrdinalityType

}

export type EpisodeOrdinality = {
  season: number
  episode: number  
} | {
  season: number
  airDate: DateTime
}

export const ordinalityDescription = (ordinality: EpisodeOrdinality) => {
  if ("airDate" in ordinality) {
    return `S${ ordinality.season } @ ${ ordinality.airDate.toISODate() }`
  }
  else {
    return `S${ ordinality.season }, E${ ordinality.episode }`
  }
}

export interface Episode {

  id: string // the ID specific to the platform
  show: Show
  platform: Platform

  ordinality: EpisodeOrdinality

}

export const formatShowPath = (show: Show) => {
  return `${ process.env.MEDIA_PATH }${ show.name }/`
}

export const formatEpisodePath = (episode: Episode) => {
  const { ordinality } = episode
  let ordinalitySuffix: string
  if ("airDate" in ordinality) {
    ordinalitySuffix = ordinality.airDate.toISODate()
  }
  else {
    ordinalitySuffix = `${ ordinality.season }x${ ordinality.episode.toFixed(0).padStart(2, "0") } - Episode ${ ordinality.episode }`
  }

  return `${ formatShowPath(episode.show) }Season ${ ordinality.season }/${ episode.show.name } - ${ ordinalitySuffix }.mkv`
}