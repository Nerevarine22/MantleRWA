const rwaTokens = require("../data/rwa-tokens");

const MANTLE_CHAIN = "mantle";

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getCoinPrice(chain, contractAddress) {
  const tokenIdentifier = `${chain}:${contractAddress}`;
  const data = await fetchJson(
    `https://coins.llama.fi/prices/current/${tokenIdentifier}`
  );
  const token = data.coins?.[tokenIdentifier];

  if (!token) {
    throw new Error(`No price data found for ${tokenIdentifier}`);
  }

  return token;
}

async function getTokenPrice(contractAddress) {
  return getCoinPrice(MANTLE_CHAIN, contractAddress);
}

async function getHistoricalTVL() {
  return fetchJson("https://api.llama.fi/v2/historicalChainTvl/mantle");
}

async function getStablecoinData(stablecoinId) {
  return fetchJson(
    `https://stablecoins.llama.fi/stablecoincharts/Mantle?stablecoin=${stablecoinId}`
  );
}

async function getProtocolData(protocolSlug) {
  return fetchJson(`https://api.llama.fi/protocol/${protocolSlug}`);
}

function getHealthCategory(score) {
  if (score >= 80) {
    return "high";
  }

  if (score >= 50) {
    return "medium";
  }

  return "low";
}

async function getProtocolSummary(protocolSlug) {
  const data = await getProtocolData(protocolSlug);
  const mantleTvl = data.currentChainTvls?.Mantle || 0;
  const platformStrength =
    (data.twitter ? 20 : 0) +
    (data.github ? 20 : 0) +
    (data.gecko_id ? 20 : 0) +
    (data.cmcId ? 20 : 0) +
    (Array.isArray(data.chains) && data.chains.length > 1 ? 20 : 10);

  return {
    slug: protocolSlug,
    name: data.name,
    mantleTvl,
    healthScore: platformStrength,
    healthCategory: getHealthCategory(platformStrength),
    hasTwitter: Boolean(data.twitter),
    hasGithub: Boolean(data.github),
    isMultiChain: Array.isArray(data.chains) && data.chains.length > 1
  };
}

async function getMarketOverview() {
  const tvlData = await getHistoricalTVL();
  const latest = tvlData.at(-1);
  const dayAgo = tvlData.at(-2) || latest;
  const weekAgo = tvlData.at(-8) || latest;

  const dailyChange = dayAgo?.tvl
    ? ((latest.tvl - dayAgo.tvl) / dayAgo.tvl) * 100
    : 0;
  const weeklyChange = weekAgo?.tvl
    ? ((latest.tvl - weekAgo.tvl) / weekAgo.tvl) * 100
    : 0;

  return {
    currentTvl: latest.tvl,
    dailyChange,
    weeklyChange,
    updatedAt: latest.date
  };
}

async function getStablecoinOverview() {
  const [usdtSeries, usdcSeries] = await Promise.all([
    getStablecoinData(1),
    getStablecoinData(2)
  ]);

  const usdt = usdtSeries.at(-1)?.totalBridgedToUSD?.peggedUSD || 0;
  const usdc = usdcSeries.at(-1)?.totalBridgedToUSD?.peggedUSD || 0;

  return {
    usdt,
    usdc,
    total: usdt + usdc,
    leader: usdt >= usdc ? "USDT" : "USDC"
  };
}

async function getProtocolOverview() {
  const [merchantMoe, treehouse] = await Promise.all([
    getProtocolSummary("merchant-moe"),
    getProtocolSummary("treehouse-protocol")
  ]);

  return [merchantMoe, treehouse];
}

async function getRwaWatchlist() {
  const results = await Promise.allSettled(
    rwaTokens.map(async (token) => {
      const livePrice = await getCoinPrice(token.chain, token.address);
      return {
        ...token,
        symbol: livePrice.symbol.toUpperCase(),
        price: livePrice.price,
        confidence: livePrice.confidence ?? null,
        updatedAt: livePrice.timestamp
      };
    })
  );

  return results
    .map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      return {
        ...rwaTokens[index],
        price: null,
        confidence: null,
        updatedAt: null,
        error: result.reason instanceof Error ? result.reason.message : "Price unavailable"
      };
    });
}

module.exports = {
  getCoinPrice,
  getTokenPrice,
  getHistoricalTVL,
  getStablecoinData,
  getProtocolSummary,
  getMarketOverview,
  getStablecoinOverview,
  getProtocolOverview,
  getRwaWatchlist
};
