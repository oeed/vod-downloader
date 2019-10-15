const stopProxy = () => exec(`sh ${ path.join(__dirname, "stop-proxy.sh") }`)

let isConnected = false
const createConnection = () => new Promise((resolve, reject) => {
  let hasResolved = false
  console.log("Connecting proxy...")
  const proxyProcess = spawn("sh", [path.join(__dirname, "proxy.sh")])
  proxyProcess.stdout.setEncoding('utf8');
  proxyProcess.stderr.setEncoding('utf8');

  const onData = data => {
    if (!hasResolved) {
      console.log(data)
    }
    if (!hasResolved && data.indexOf("Local forwarding listening on 127.0.0.1 port 2001") !== -1) {
      console.log("Proxy connected")
      isConnected = true
      hasResolved = true
      resolve(proxyProcess)
    }
  }
  proxyProcess.stdout.on('data', onData)
  proxyProcess.stderr.on('data', onData)
  

  setTimeout(() => {
    if (!hasResolved) {
      exec(`sh ${ path.join(__dirname, "stop-proxy.sh") }`)
      reject("Proxy timeout")
      hasResolved = true
    }
  }, 120000)

})

let connectResolver
const connectProxy = () => {
  if (isConnected) {
    return Promise.resolve()
  }
  else if (connectResolver) {
    return connectResolver
  }
  else {
    connectResolver = createConnection()
    return connectResolver
  }
}

module.exports = {
  stopProxy,
  connectProxy
}