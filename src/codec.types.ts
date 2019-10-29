import EncryptionMethod from "encryption";
import { IncomingHttpHeaders } from "http";
import { Logger } from "log.helper";
import { DateTime } from "luxon";
import { Connection } from "proxy";

export interface SplitStreamResult {
  video: string
  audio: string
}

export type CodecResult = string | SplitStreamResult

export type CodecHeaders = IncomingHttpHeaders & { [index: string]: string }

export interface Codec {

  downloadPlaylist: (log: Logger, fileID: string, platlistURL: string, connection: Connection, encryption?: EncryptionMethod, headers?: CodecHeaders) => Promise<CodecResult>

}


export interface StreamingCodec {

  recordPlaylist: (log: Logger, fileID: string, platlistURL: string, startTime: DateTime, endTime: DateTime, connection: Connection, headers?: CodecHeaders) => Promise<CodecResult>

}