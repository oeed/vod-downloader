import { loadSaved } from "episode-record";
import * as fs from 'fs';
import { checkAllLiveShows } from "live-check";
import { Freeview } from "live-platforms/freeview.live-platform";
import { SBS } from "ondemand-platforms/sbs.ondemand-platform";
import { TenPlay } from "ondemand-platforms/ten-play.ondemand-platform";
import { ThreeNow } from "ondemand-platforms/three-now.ondemand-platform";
import { registerPlatforms } from "platform.types";
import { loadShows } from "shows.helper";
import { stopProxy } from "./proxy";

process.on('exit', () => stopProxy())

console.log(`Media path: ${ process.env.MEDIA_PATH! }`)
if (!fs.existsSync(process.env.MEDIA_PATH!)) {
  throw new Error("Media path not mounted!")
}

registerPlatforms([
  TenPlay,
  ThreeNow,
  Freeview,
  SBS
])
loadSaved()
loadShows()

/* setInterval(() => {
  checkOnDemandAllShows().then(() => {
    console.log("Complete!")
    stopProxy()
    process.exit()
  }).catch(error => {
    stopProxy()
    throw error
  })
}, 15 * 60 * 1000) */

checkAllLiveShows()