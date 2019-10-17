import { downloadEpisode } from "download";
import { isEpisodeLoaded, saveEpisode } from "episode-record";
import * as fs from 'fs';
import * as path from "path";
import { getPlatform } from "platform.types";
import { ordinalityDescription, Show } from "shows.types";
import asyncPool from "tiny-async-pool";

console.log(__dirname)

const SHOWS_PATH = path.join(__dirname, "../shows.json")
let shows: Show[]
export const loadShows = () => {
  if (!fs.existsSync(SHOWS_PATH)) {
    throw new Error("No shows file")
  }

  shows = JSON.parse(fs.readFileSync(SHOWS_PATH, "utf-8"))
}

export type Logger = ReturnType<typeof getLogger>
const getLogger = (show: Show) => (message: string) => console.log(`[${ show.id }]: ${ message }`) 

const checkShow = async (show: Show) => {
  const log = getLogger(show)
  log(`Checking show: ${ show.name }`)
  const platform = getPlatform(show.platformID)
  const latestEpisode = await platform.checkShow(log, show)
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

export const checkAllShows = () => asyncPool(MAX_CONCURRENT_SHOWS, shows, checkShow)