const refreshButton = document.getElementById("refreshButton");
const statusText = document.getElementById("statusText");

function formatCurrency(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits
  }).format(value);
}

function formatPercent(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function renderProtocols(protocols) {
  const protocolList = document.getElementById("protocolList");

  protocolList.innerHTML = protocols
    .map(
      (protocol) => `
        <article class="protocol-item">
          <div class="protocol-topline">
            <h3 class="protocol-name">${protocol.name}</h3>
            <span class="badge ${protocol.healthCategory}">${protocol.healthCategory}</span>
          </div>
          <p class="protocol-meta">
            Mantle TVL: ${formatCurrency(protocol.mantleTvl)}<br />
            Health Score: ${protocol.healthScore}/100<br />
            Presence: ${protocol.hasTwitter ? "Twitter" : "No Twitter"} · ${
              protocol.hasGithub ? "GitHub" : "No GitHub"
            } · ${protocol.isMultiChain ? "Multi-chain" : "Mantle-first"}
          </p>
        </article>
      `
    )
    .join("");
}

function renderRwaPrices(tokens) {
  const rwaGrid = document.getElementById("rwaGrid");

  rwaGrid.innerHTML = tokens
    .map((token) => {
      const priceText =
        typeof token.price === "number"
          ? formatCurrency(token.price, token.price > 100 ? 2 : 4)
          : "Unavailable";

      const confidenceText =
        typeof token.confidence === "number"
          ? `${Math.round(token.confidence * 100)}% confidence`
          : "No confidence score";

      return `
        <article class="rwa-item">
          <div class="protocol-topline">
            <div>
              <p class="rwa-ticker">${token.ticker}</p>
              <h3 class="protocol-name">${token.name}</h3>
            </div>
            <span class="badge neutral">${token.category}</span>
          </div>
          <p class="rwa-price">${priceText}</p>
          <p class="protocol-meta">
            Issuer: ${token.issuer}<br />
            Chain: ${token.chain}<br />
            ${confidenceText}
          </p>
          <p class="rwa-note">${token.note}</p>
        </article>
      `;
    })
    .join("");
}

async function loadDashboard() {
  statusText.textContent = "Refreshing market intelligence...";

  try {
    const [marketResponse, stableResponse, protocolResponse, rwaResponse] =
      await Promise.all([
        fetch("/api/market-overview"),
        fetch("/api/stablecoins"),
        fetch("/api/protocols"),
        fetch("/api/rwa-prices")
      ]);

    if (
      !marketResponse.ok ||
      !stableResponse.ok ||
      !protocolResponse.ok ||
      !rwaResponse.ok
    ) {
      throw new Error("One or more live endpoints returned an error.");
    }

    const [market, stablecoins, protocols, rwaTokens] = await Promise.all([
      marketResponse.json(),
      stableResponse.json(),
      protocolResponse.json(),
      rwaResponse.json()
    ]);

    setText("marketTvl", formatCurrency(market.currentTvl));
    setText("marketDaily", formatPercent(market.dailyChange));
    setText("marketWeekly", formatPercent(market.weeklyChange));

    setText("usdtTvl", formatCurrency(stablecoins.usdt));
    setText("usdcTvl", formatCurrency(stablecoins.usdc));
    setText("stableLeader", stablecoins.leader);

    renderProtocols(protocols);
    renderRwaPrices(rwaTokens);

    const now = new Date().toLocaleTimeString("uk-UA");
    statusText.textContent = `Live data refreshed at ${now}.`;
  } catch (error) {
    const protocolList = document.getElementById("protocolList");
    const rwaGrid = document.getElementById("rwaGrid");
    protocolList.innerHTML =
      '<p class="error-copy">Could not load live protocol data.</p>';
    rwaGrid.innerHTML =
      '<p class="error-copy">Could not load RWA watchlist prices.</p>';
    statusText.textContent =
      error instanceof Error
        ? `Load error: ${error.message}`
        : "An unknown error occurred.";
  }
}

refreshButton.addEventListener("click", loadDashboard);

loadDashboard();
