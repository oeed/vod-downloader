import { VideoEncryption } from "codecs/m3u8.codec";
import { IncomingHttpHeaders } from "http";
import { Connection } from "proxy";
import { Logger } from "show-check";

export interface SplitStreamResult {
  video: string
  audio: string
}

export type CodecResult = string | SplitStreamResult

export type CodecHeaders = IncomingHttpHeaders & { [index: string]: string }

export interface Codec {

  downloadPlaylist: (log: Logger, fileID: string, platlistURL: string, connection: Connection, encryption?: VideoEncryption, headers?: CodecHeaders) => Promise<CodecResult>

}