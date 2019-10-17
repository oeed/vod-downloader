
import { exec } from 'child_process';
import { SplitStreamResult } from 'codec.types';
import * as fs from 'fs';
import mv from 'mv';
import * as path from "path";
import { Logger } from 'show-check';
import { Episode, formatEpisodePath } from "shows.types";
import { connectProxy, localConnection } from "./proxy";

const mergeAudioVideo = (log: Logger, result: SplitStreamResult, temporaryPath: string) => new Promise(resolve => exec(`ffmpeg -i ${ result.video } -i ${ result.audio } -c copy ${ temporaryPath }`, (output, o2) => {
  if (output !== null) {
    throw new Error(`Merge fail: ${ o2 }`)
  }
  log("Merge done")
  fs.unlinkSync(result.video)
  fs.unlinkSync(result.audio)
  resolve()
}))

export const downloadEpisode = (log: Logger, episode: Episode) => new Promise(async (resolve, reject) => {
  const connection = episode.platform.needsProxy ? await connectProxy() : localConnection()
  
  const fileID = `${ episode.show.id }-${ episode.id }`
  const result = await episode.platform.downloadEpisode(log, fileID, episode, connection)

  let temporaryPath: string
  if (typeof result === "string") {
    temporaryPath = result
  }
  else {
    temporaryPath = path.join(__dirname, `../output/${ fileID }.mkv`)

    log("Merging audio and video...")
    if (fs.existsSync(temporaryPath)) {
      fs.unlinkSync(temporaryPath)
    } 

    await mergeAudioVideo(log, result, temporaryPath)
  }

  const destinationPath = formatEpisodePath(episode)
  const directoryPath = path.dirname(destinationPath)
  const parentPath = path.dirname(directoryPath)
  // TODO: if show is once off, delete other episodes in formatShowPath

  log(`Moving ${ fileID }.mkv to: ${ destinationPath }`)
  if (!fs.existsSync(parentPath)) {
    log(`Making directory: ${ parentPath }`)
    fs.mkdirSync(parentPath)
  }
  if (!fs.existsSync(directoryPath)) {
    log(`Making directory: ${ directoryPath }`)
    fs.mkdirSync(directoryPath)
  }

  if (episode.show.mostRecentOnly) {
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        return reject(err)
      }
    
      for (const file of files) {
        log(`Removing old episode: ${ file }`)
        fs.unlink(path.join(directoryPath, file), err => {
          if (err) reject(err)
        });
      }
    });
  }

  mv(temporaryPath, destinationPath, err => {
    if (err) {
      reject(err)
    }
    else {
      resolve()
    }
  })
})