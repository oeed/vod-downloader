import * as fs from 'fs';
import * as path from "path";
import { Episode } from "./shows.types";

interface ExistingEpisodes {
  [showID: string]: {
    [episodeID: string]: boolean
  }
}

const EPISODES_PATH = path.join(__dirname, "../episodes.json")
let existingEpisodes: ExistingEpisodes
export const loadSaved = () => {
  existingEpisodes = fs.existsSync(EPISODES_PATH) ? JSON.parse(fs.readFileSync(EPISODES_PATH, "utf-8")) : {}
}

export const isEpisodeLoaded = (episode: Episode) => {
  const { show: { id: showID } } = episode
  if (existingEpisodes[showID]) {
    return !!existingEpisodes[showID][episode.id]
  }
  return false
}

export const saveEpisode = (episode: Episode) => {
  const { show: { id: showID, mostRecentOnly } } = episode
  if (mostRecentOnly) {
    existingEpisodes[showID] = {}
  }
  else {
    existingEpisodes[showID] = existingEpisodes[showID] || {}
  }
  existingEpisodes[showID][episode.id] = true
  fs.writeFileSync(EPISODES_PATH, JSON.stringify(existingEpisodes))
}