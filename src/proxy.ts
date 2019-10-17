import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process'
import { ServerResponse } from "http"
import { RequestOptions } from 'https'
import miniget from "miniget"
import * as path from "path"
import SocksProxyAgent from 'socks-proxy-agent'
import { parse as parseURL } from 'url'

export type GetFunction = (url: string, headers?: { [key: string]: string | number }) => Promise<GetResult>
export interface GetResult {
  response: ServerResponse
  body: any
}

export interface Connection {
  get: GetFunction
  options: {
    transform: (parsed: any) => RequestOptions
  }
}

export interface ProxyConnection extends Connection {
  proxyProcess: ChildProcessWithoutNullStreams
}

let proxyConnection: ProxyConnection | undefined
let isConnected = false
const createConnection = () => new Promise<ProxyConnection>((resolve, reject) => {
  let hasResolved = false
  console.log("Connecting proxy...")
  const proxyProcess = spawn("sh", [path.join(__dirname, "../proxy.sh")])
  proxyProcess.stdout.setEncoding('utf8');
  proxyProcess.stderr.setEncoding('utf8');

  const onData = (data: string) => {
    if (!hasResolved) {
      console.log("[Proxy]:", data)
    }
    if (!hasResolved && data.indexOf("Local forwarding listening on 127.0.0.1 port 2001") !== -1) {
      console.log("Proxy connected")
      isConnected = true
      hasResolved = true

      const proxy = process.env.PROXY || 'socks://127.0.0.1:2001'
      const agent = new SocksProxyAgent(proxy)

      const options = {
        transform: (parsed: any) => {
          const opts = parseURL(parsed.href) as unknown as RequestOptions
          opts.agent = agent
          opts.headers = parsed.headers
          return opts
        }
      }

      const get: GetFunction = (url: string, headers: { [key: string]: string | number } = {}) => new Promise<GetResult>((resolve, reject) => {
        miniget(url, Object.assign({ headers }, options), (err: Error | undefined, response: ServerResponse, body: any) => {
          if (err) {
            reject(err)
          }
          else {
            resolve({ response, body })
          }
        })
      })

      resolve({
        proxyProcess,
        get,
        options
      })
    }
  }
  proxyProcess.stdout.on('data', onData)
  proxyProcess.stderr.on('data', onData)
  

  setTimeout(() => {
    if (!hasResolved) {
      stopProxy()
      reject("Proxy timeout")
      hasResolved = true
    }
  }, 120000)

})

export const stopProxy = () => {
  if (proxyConnection) {
    console.log("Stopping proxy...")
    proxyConnection.proxyProcess.kill()
    proxyConnection = undefined
    isConnected = false
  }
  exec(`sh ${ path.join(__dirname, "../stop-proxy.sh") }`)
}

let connectResolver: Promise<ProxyConnection>
export const connectProxy = () => {
  if (isConnected && proxyConnection) {
    return Promise.resolve(proxyConnection)
  }
  else if (connectResolver) {
    return connectResolver
  }
  else {
    connectResolver = createConnection()
    return connectResolver
  }
}

export const localConnection = (): Connection => {
  const options = {
    transform: (parsed: any) => {
      const opts = parseURL(parsed.href) as unknown as RequestOptions
      return opts
    }
  }

  const get: GetFunction = (url: string, headers: { [key: string]: string | number } = {}) => new Promise<GetResult>((resolve, reject) => {
    miniget(url, Object.assign({ headers }, options), (err: Error | undefined, response: ServerResponse, body: any) => {
      if (err) {
        reject(err)
      }
      else {
        resolve({ response, body })
      }
    })
  })

  return {
    get,
    options
  }
}