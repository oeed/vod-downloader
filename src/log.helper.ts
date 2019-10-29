import { Platform } from "platform.types"
import { Show } from "shows.helper"

export type Logger = ReturnType<typeof getShowLogger>

export const getShowLogger = (show: Show<any>) => (message: string) => console.log(`[${ show.id }]: ${ message }`) 
export const getPlatformLogger = (platform: Platform) => (message: string) => console.log(`[${ platform.id }]: ${ message }`) 