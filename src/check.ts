import { loadSaved } from "episode-record";
import * as fs from 'fs';
import { registerPlatforms } from "platform.types";
import { TenPlay } from "platforms/ten-play.platform";
import { checkAllShows, loadShows } from "show-check";
import { stopProxy } from "./proxy";

process.on('exit', () => stopProxy())

console.log(`Media path: ${ process.env.MEDIA_PATH! }`)
if (!fs.existsSync(process.env.MEDIA_PATH!)) {
  throw new Error("Media path not mounted!")
}

loadSaved()
loadShows()
registerPlatforms([
  TenPlay
])

checkAllShows().then(() => stopProxy()).catch(error => {
  stopProxy()
  throw error
})