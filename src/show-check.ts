import { downloadEpisode } from "download";
import { isEpisodeLoaded, saveEpisode } from "episode-record";
import * as fs from 'fs';
import * as path from "path";
import { getPlatform } from "platform.types";
import { ordinalityDescription, Show } from "shows.types";

console.log(__dirname)

const SHOWS_PATH = path.join(__dirname, "../shows.json")
let shows: Show[]
export const loadShows = () => {
  if (!fs.existsSync(SHOWS_PATH)) {
    throw new Error("No shows file")
  }

  shows = JSON.parse(fs.readFileSync(SHOWS_PATH, "utf-8"))
}

const checkShow = async (show: Show) => {
  console.log(`Checking show: ${ show.name }`)
  const platform = getPlatform(show.platformID)
  const latestEpisode = await platform.checkShow(show)
  if (!isEpisodeLoaded(latestEpisode)) {
    console.log(`New episode: ${ ordinalityDescription(latestEpisode.ordinality) }`)
    await downloadEpisode(latestEpisode)
    saveEpisode(latestEpisode)
    console.log(`Episode complete: ${ show.name }`)
  }
  else {
    console.log(`No new episode.`)
  }
}

export const checkAllShows = async () => {
  for (const show of shows) {
    await checkShow(show)
  }
  console.log("All shows complete")
}