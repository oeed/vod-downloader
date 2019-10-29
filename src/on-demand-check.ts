import { downloadEpisode } from "download";
import { isEpisodeLoaded, saveEpisode } from "episode-record";
import { getShowLogger } from "log.helper";
import { OnDemandPlatform } from "platform.types";
import { getShows, ordinalityDescription, Show } from "shows.helper";
import asyncPool from "tiny-async-pool";

const checkShow = async (show: Show<OnDemandPlatform>) => {
  const log = getShowLogger(show)
  log(`Checking show: ${ show.name }`)
  const latestEpisode = await show.platform.checkShow(log, show)
  if (!isEpisodeLoaded(latestEpisode)) {
    log(`New episode: ${ ordinalityDescription(latestEpisode.ordinality) }`)
    await downloadEpisode(log, latestEpisode)
    saveEpisode(latestEpisode)
    log(`Episode complete: ${ show.name }`)
  }
  else {
    log(`No new episode.`)
  }
}

const MAX_CONCURRENT_SHOWS = 2
export const checkOnDemandAllShows = () => asyncPool(MAX_CONCURRENT_SHOWS, getShows(), checkShow)