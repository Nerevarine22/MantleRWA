const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  getMarketOverview,
  getProtocolOverview,
  getRwaWatchlist,
  getStablecoinOverview,
  getTokenPrice
} = require("./lib/mantle-tools");

const host = "127.0.0.1";
const port = 3000;
const publicDir = path.join(__dirname, "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendFile(filePath, res) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.end(error.code === "ENOENT" ? "404 Not Found" : "500 Server Error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    });
    res.end(content);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function handleApiRequest(url, res) {
  try {
    if (url.pathname === "/api/market-overview") {
      sendJson(res, 200, await getMarketOverview());
      return true;
    }

    if (url.pathname === "/api/stablecoins") {
      sendJson(res, 200, await getStablecoinOverview());
      return true;
    }

    if (url.pathname === "/api/protocols") {
      sendJson(res, 200, await getProtocolOverview());
      return true;
    }

    if (url.pathname === "/api/rwa-prices") {
      sendJson(res, 200, await getRwaWatchlist());
      return true;
    }

    if (url.pathname === "/api/token-price") {
      const contractAddress = url.searchParams.get("contract_address");

      if (!contractAddress) {
        sendJson(res, 400, {
          error: "Missing contract_address query parameter"
        });
        return true;
      }

      sendJson(res, 200, await getTokenPrice(contractAddress));
      return true;
    }
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unknown server error"
    });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);

  if (url.pathname.startsWith("/api/")) {
    await handleApiRequest(url, res);
    return;
  }

  let safePath = "public/index.html";

  if (url.pathname === "/PROJECT_MEMORY.md") {
    safePath = "PROJECT_MEMORY.md";
  } else if (url.pathname !== "/") {
    safePath = `public/${url.pathname.replace(/^\/+/, "")}`;
  }

  const filePath = path.normalize(path.join(__dirname, safePath));

  if (!filePath.startsWith(publicDir) && filePath !== path.join(__dirname, "PROJECT_MEMORY.md")) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 Forbidden");
    return;
  }

  sendFile(filePath, res);
});

server.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});
