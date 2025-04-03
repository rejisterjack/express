const http = require("http")
const url = require("url")
const fs = require("fs")
const path = require("path")

class CreateExpress {
  constructor() {
    this.routes = {
      GET: {},
      POST: {},
      PUT: {},
      DELETE: {},
    }
    this.middleware = []
  }

  get(path, ...handlers) {
    this.routes.GET[path] = handlers
  }

  post(path, ...handlers) {
    this.routes.POST[path] = handlers
  }

  put(path, ...handlers) {
    this.routes.GET[path] = handlers
  }

  delete(path, ...handlers) {
    this.routes.DELETE[path] = handlers
  }

  use(...args) {
    if (typeof args[0] === "string") {
      const [path, ...handlers] = args
      handlers.forEach((handler) => {
        this.middleware.push({ path, handler })
      })
    } else {
      args.forEach((handler) => {
        this.middleware.push({ path: null, handler })
      })
    }
  }

  static(root) {
    return (req, res, next) => {
      const filePath = path.join(root, req.url)

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) return next()

        const stream = fs.createReadStream(filePath)
        stream.on("error", next)

        res.setHeader("Content-Type", this.getContentType(filePath))
        stream.pipe(res)
      })
    }
  }

  listen(port, callback) {
    const server = http.createServer(async (req, res) => {
      const enhancedReq = this.enhanceRequest(req)
      const enhancedRes = this.enhanceResponse(res)

      try {
        if (["POST", "PUT", "PATCH"].includes(req.method)) {
          await this.parseBody(enhancedReq, enhancedRes)
        }

        await this.runMiddleware(enhancedReq, enhancedRes)

        await this.handleRequest(enhancedReq, enhancedRes)
      } catch (err) {
        enhancedRes.status(500).send("Server Error")
      }
    })

    server.listen(port, callback)
    return server
  }

  enhanceRequest(req) {
    const parsedUrl = url.parse(req.url, true)
    req.query = parsedUrl.query
    req.params = {}
    req.path = parsedUrl.pathname
    return req
  }

  enhanceResponse(res) {
    res.status = function (code) {
      this.statusCode = code
      return this
    }

    res.send = function (body) {
      if (typeof body === "object") {
        this.setHeader("Content-Type", "application/json")
        body = JSON.stringify(body)
      } else if (typeof body === "string") {
        this.setHeader("Content-Type", "text/html")
      }

      this.end(body)
    }

    res.json = function (body) {
      this.setHeader("Content-Type", "application/json")
      this.end(JSON.stringify(body))
    }

    return res
  }

  async parseBody(req, res) {
    return new Promise((resolve, reject) => {
      let body = ""
      req.on("data", (chunk) => {
        body += chunk.toString()
      })
      req.on("end", () => {
        try {
          req.body = body ? JSON.parse(body) : {}
          resolve()
        } catch (err) {
          res.status(400).send("Invalid JSON")
          reject(err)
        }
      })
      req.on("error", reject)
    })
  }

  async runMiddleware(req, res) {
    for (const layer of this.middleware) {
      if (layer.path && !req.path.startsWith(layer.path)) continue

      await new Promise((resolve, reject) => {
        layer.handler(req, res, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    }
  }

  async handleRequest(req, res) {
    const method = req.method
    const path = req.path
    const handlers =
      this.routes[method]?.[path] || this.findMatchingRoute(method, path)

    if (!handlers) {
      return res.status(404).send("Not Found")
    }

    for (const handler of handlers) {
      await new Promise((resolve, reject) => {
        handler(req, res, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    }
  }

  findMatchingRoute(method, path) {
    const routes = Object.keys(this.routes[method] || {})

    for (const route of routes) {
      const { match, params } = this.matchRoute(route, path)
      if (match) {
        req.params = params
        return this.routes[method][route]
      }
    }

    return null
  }

  matchRoute(route, path) {
    const routeParts = route.split("/")
    const pathParts = path.split("/")
    const params = {}

    if (routeParts.length !== pathParts.length) {
      return { match: false, params: {} }
    }

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(":")) {
        params[routeParts[i].substring(1)] = pathParts[i]
      } else if (routeParts[i] !== pathParts[i]) {
        return { match: false, params: {} }
      }
    }

    return { match: true, params }
  }

  getContentType(filePath) {
    const ext = path.extname(filePath)
    const contentTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
    }
    return contentTypes[ext] || "text/plain"
  }
}

function express() {
  return new CreateExpress()
}

module.exports = express
