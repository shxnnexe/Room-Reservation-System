const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs/promises");
const path = require("node:path");

const port = Number(process.env.FRONTEND_PORT || 4173);
const backendOrigin = new URL(process.env.ROOM_API_ORIGIN || "http://127.0.0.1:3000");
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("FRONTEND_PORT must be a valid TCP port.");
}

if (
  !["http:", "https:"].includes(backendOrigin.protocol)
  || backendOrigin.username
  || backendOrigin.password
  || backendOrigin.pathname !== "/"
  || backendOrigin.search
  || backendOrigin.hash
) {
  throw new Error("ROOM_API_ORIGIN must be an HTTP(S) origin without credentials, path, query, or fragment.");
}

const backendTransport = backendOrigin.protocol === "https:" ? https : http;

function sendError(res, status, message) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ success: false, error: { message } }));
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (requestUrl.pathname.startsWith("/api/")) {
    const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, backendOrigin);
    const proxyRequest = backendTransport.request(target, {
      method: req.method,
      headers: { ...req.headers, host: target.host },
    });

    proxyRequest.on("response", (backendResponse) => {
      res.writeHead(backendResponse.statusCode, backendResponse.headers);
      backendResponse.pipe(res);
    });
    proxyRequest.on("error", (error) => {
      console.error(`Backend API proxy failed: ${error.message}`);
      if (!res.headersSent) {
        sendError(res, 502, "The backend API could not be reached.");
      } else {
        res.destroy(error);
      }
    });

    req.pipe(proxyRequest);
    return;
  }

  const file = staticFiles.get(requestUrl.pathname);
  if (!file) {
    sendError(res, 404, "Frontend file not found.");
    return;
  }

  try {
    const content = await fs.readFile(path.join(__dirname, file[0]));
    res.writeHead(200, {
      "Content-Type": file[1],
      "Cache-Control": "no-store",
    });
    res.end(content);
  } catch (error) {
    console.error(`Frontend file could not be read: ${error.message}`);
    sendError(res, 500, "The frontend file could not be served.");
  }
});

server.listen(port, () => {
  console.log(`Room Reservation frontend listening on port ${port}; API proxy target ${backendOrigin.origin}`);
});
