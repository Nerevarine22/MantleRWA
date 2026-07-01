const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  getMarketOverview,
  getProtocolOverview,
  getRwaWatchlist,
  getStablecoinOverview,
  getTokenPrice,
  getMantlePools
} = require("./lib/mantle-tools");
const { getChatResponse, getChatHistory } = require("./lib/chat-agent");
const { startNewsAgent } = require("./lib/news-agent");

// Start daily news agent background task
startNewsAgent();

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

function readPostBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleApiRequest(url, res, req) {
  try {
    if (url.pathname === "/api/chat" && req.method === "POST") {
      const bodyStr = await readPostBody(req);
      const { message, sessionId, contextTrigger } = JSON.parse(bodyStr);
      const responseObj = await getChatResponse(message, sessionId, contextTrigger);
      sendJson(res, 200, responseObj);
      return true;
    }

    if (url.pathname === "/api/chat/history" && req.method === "GET") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        sendJson(res, 400, { error: "Missing sessionId" });
        return true;
      }
      const history = await getChatHistory(sessionId);
      // Фільтруємо системні та tool повідомлення для UI, повертаємо лише user і assistant
      const displayHistory = history.filter(m => m.role === "user" || m.role === "assistant");
      sendJson(res, 200, displayHistory);
      return true;
    }

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

    if (url.pathname === "/api/pools") {
      sendJson(res, 200, await getMantlePools());
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

    if (url.pathname === "/api/news" && req.method === "GET") {
      const { db } = require("./lib/firebase");
      if (!db) {
        sendJson(res, 500, { error: "DB not initialized" });
        return true;
      }
      try {
        const snapshot = await db.collection("news").orderBy("createdAt", "desc").limit(6).get();
        const news = snapshot.docs.map(doc => doc.data());
        sendJson(res, 200, news);
      } catch (err) {
        sendJson(res, 500, { error: "Failed to fetch news" });
      }
      return true;
    }

    if (url.pathname === "/api/portfolio") {
      const { db } = require("./lib/firebase");
      if (req.method === "GET") {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId || !db) {
          sendJson(res, 400, { error: "Missing sessionId or DB not connected" });
          return true;
        }
        const doc = await db.collection("portfolios").doc(sessionId).get();
        sendJson(res, 200, doc.exists ? doc.data().assets || [] : []);
        return true;
      }
      
      if (req.method === "POST") {
        const bodyStr = await readPostBody(req);
        const { sessionId, assets } = JSON.parse(bodyStr);
        if (!sessionId || !db) {
          sendJson(res, 400, { error: "Missing sessionId or DB not connected" });
          return true;
        }
        await db.collection("portfolios").doc(sessionId).set({ assets, updatedAt: new Date() }, { merge: true });
        sendJson(res, 200, { success: true });
        return true;
      }
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
    await handleApiRequest(url, res, req);
    return;
  }

  let safePath = "public/index.html";

  if (url.pathname === "/PROJECT_MEMORY.md") {
    safePath = "PROJECT_MEMORY.md";
  } else if (url.pathname === "/portfolio" || url.pathname === "/portfolio.html") {
    safePath = "public/portfolio.html";
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
