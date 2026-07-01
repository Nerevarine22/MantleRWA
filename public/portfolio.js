let availableAssets = [];
let portfolio = [];
let isUsdMode = true;

const colors = ["#00f2ff", "#ff00e5", "#adff00", "#ffaa00", "#00aaff", "#ff3366"];

async function loadAssets() {
  try {
    const res = await fetch('/api/rwa-prices');
    availableAssets = await res.json();
    
    const container = document.getElementById("assetCheckboxes");
    container.innerHTML = '';
    
    availableAssets.forEach(asset => {
      const opt = document.createElement("div");
      opt.className = "select-option-label";
      opt.innerHTML = `${asset.ticker} - ${asset.name} ($${asset.price.toFixed(2)})`;
      opt.onclick = () => selectAssetOption(asset.ticker, opt.innerHTML);
      container.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load assets", err);
  }
}

let selectedAssetTicker = "";

window.selectAssetOption = function(ticker, labelHtml) {
  selectedAssetTicker = ticker;
  document.getElementById("selectHeader").innerHTML = labelHtml;
  document.getElementById('assetCheckboxes').style.display = 'none';
};

document.addEventListener("click", (e) => {
  if (!e.target.closest('.custom-multi-select')) {
    const opts = document.getElementById("assetCheckboxes");
    if(opts) opts.style.display = "none";
  }
});

async function loadPortfolio() {
  let sessionId = localStorage.getItem("chatSessionId");
  if (!sessionId) {
    sessionId = "session-" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("chatSessionId", sessionId);
  }
  
  try {
    const res = await fetch(`/api/portfolio?sessionId=${sessionId}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      portfolio = data;
      renderPortfolio();
    }
  } catch (err) {
    console.error("Failed to load portfolio", err);
  }
}

document.getElementById("btnToggleUsd").addEventListener("click", () => {
  isUsdMode = true;
  document.getElementById("btnToggleUsd").classList.add("active");
  document.getElementById("btnToggleTokens").classList.remove("active");
  document.getElementById("amountLabel").textContent = "Amount ($)";
});

document.getElementById("btnToggleTokens").addEventListener("click", () => {
  isUsdMode = false;
  document.getElementById("btnToggleTokens").classList.add("active");
  document.getElementById("btnToggleUsd").classList.remove("active");
  document.getElementById("amountLabel").textContent = "Amount (Tokens)";
});

document.getElementById("addAssetBtn").addEventListener("click", () => {
  const amountVal = parseFloat(document.getElementById("amountInput").value);
  
  if (!selectedAssetTicker || isNaN(amountVal) || amountVal <= 0) return;
  
  const ticker = selectedAssetTicker;
  const assetData = availableAssets.find(a => a.ticker === ticker);
  if (!assetData) return;
  
  let tokenAmount = 0;
  let usdValue = 0;
  
  if (isUsdMode) {
    usdValue = amountVal;
    tokenAmount = usdValue / assetData.price;
  } else {
    tokenAmount = amountVal;
    usdValue = tokenAmount * assetData.price;
  }
  
  const existingIdx = portfolio.findIndex(p => p.ticker === ticker);
  if (existingIdx >= 0) {
    portfolio[existingIdx].amount += tokenAmount;
    portfolio[existingIdx].valueUsd += usdValue;
  } else {
    portfolio.push({
      ticker: assetData.ticker,
      name: assetData.name,
      priceAtAdd: assetData.price,
      amount: tokenAmount,
      valueUsd: usdValue
    });
  }
  
  document.getElementById("amountInput").value = "";
  selectedAssetTicker = "";
  document.getElementById("selectHeader").textContent = "-- Select Asset --";
  renderPortfolio();
});

function removeAsset(ticker) {
  portfolio = portfolio.filter(p => p.ticker !== ticker);
  renderPortfolio();
}

function renderPortfolio() {
  const list = document.getElementById("holdingsList");
  const chart = document.getElementById("allocationChart");
  
  list.innerHTML = "";
  chart.innerHTML = "";
  
  let totalUsd = portfolio.reduce((sum, p) => sum + p.valueUsd, 0);
  document.getElementById("totalValueDisplay").textContent = `$${totalUsd.toFixed(2)}`;
  
  if (portfolio.length === 0) {
    list.innerHTML = '<p class="muted-desc">No assets added.</p>';
    chart.innerHTML = '<p class="muted-desc">No assets in portfolio yet.</p>';
    return;
  }
  
  portfolio.sort((a, b) => b.valueUsd - a.valueUsd);
  
  portfolio.forEach((p, idx) => {
    const pct = totalUsd > 0 ? (p.valueUsd / totalUsd) * 100 : 0;
    const color = colors[idx % colors.length];
    
    list.innerHTML += `
      <div class="asset-row">
        <div class="asset-row-left">
          <div class="token-logo-wrapper" style="width: 32px; height: 32px;">
            <div style="width:10px; height:10px; border-radius:50%; background:${color};"></div>
          </div>
          <div class="token-info">
            <span class="token-symbol">${p.ticker}</span>
            <span class="token-name">${p.amount.toFixed(4)} tokens</span>
          </div>
        </div>
        <div class="asset-row-right">
          <span class="token-symbol" style="color: var(--text-main);">$${p.valueUsd.toFixed(2)}</span>
          <button class="remove-btn" onclick="removeAsset('${p.ticker}')">Remove</button>
        </div>
      </div>
    `;
    
    chart.innerHTML += `
      <div style="display:flex; flex-direction:column; gap: 4px;">
        <div style="display:flex; justify-content:space-between; font-size:12px; font-family:var(--font-label);">
          <span style="color:var(--text-main);">${p.ticker}</span>
          <span style="color:var(--text-muted);">${pct.toFixed(1)}%</span>
        </div>
        <div class="chart-bar-bg">
          <div class="chart-bar-fill" style="width: ${pct}%; background: ${color};"></div>
        </div>
      </div>
    `;
  });
}

document.getElementById("savePortfolioBtn").addEventListener("click", async () => {
  let sessionId = localStorage.getItem("chatSessionId");
  if (!sessionId) return;
  
  try {
    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, assets: portfolio })
    });
    if (res.ok) {
      const status = document.getElementById("saveStatus");
      status.style.display = "block";
      setTimeout(() => status.style.display = "none", 3000);
    }
  } catch (err) {
    console.error("Failed to save portfolio", err);
  }
});

window.removeAsset = removeAsset;
loadAssets().then(loadPortfolio);
