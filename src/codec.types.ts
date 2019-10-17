import { Connection } from "proxy";

export interface SplitStreamResult {
  video: string
  audio: string
}

export type CodecResult = string | SplitStreamResult

export interface Codec {

  downloadPlaylist: (fileID: string, platlistURL: string, connection: Connection) => Promise<CodecResult>

}