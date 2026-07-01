const refreshButton = document.getElementById("refreshButton");
const statusText = document.getElementById("statusText");

async function fetchAndRenderPrices() {
  try {
    const response = await fetch('/api/rwa-prices');
    if (!response.ok) throw new Error('Failed to fetch prices');
    
    const tokens = await response.json();
    
    const assetGrid = document.getElementById("assetGrid");
    
    let assetHTML = '';
    
    tokens.forEach(token => {
      const isPositive = token.change24h >= 0;
      const trendClass = isPositive ? 'trend-up' : 'trend-down';
      const trendSymbol = isPositive ? '+' : '';
      const changeText = token.change24h != null ? `${trendSymbol}${token.change24h.toFixed(2)}%` : '--';
      const priceText = token.price != null ? `$${token.price.toFixed(2)}` : '--';
      const firstLetter = token.ticker.replace('x', '')[0] || token.ticker[0];
      
      const assetData = JSON.stringify({ ticker: token.ticker, price: token.price }).replace(/"/g, '&quot;');
      const logoFallbackId = `logo-${token.ticker}`;
      const cardHTML = `
        <div class="price-card" onclick="window.triggerChatWithContext(${assetData})">
          <div class="card-header">
            <div class="token-logo-wrapper">
              ${token.logoUrl 
                ? `<img src="${token.logoUrl}" alt="${token.ticker}" class="token-logo" id="${logoFallbackId}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"/><span class="logo-fallback" style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--text-muted);">${firstLetter}</span>`
                : `<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--text-muted);">${firstLetter}</span>`
              }
            </div>
            <div class="token-info">
              <span class="token-symbol">${token.ticker}</span>
              <span class="token-name">${token.name}</span>
            </div>
          </div>
          <div class="card-body">
            <span class="token-price">${priceText}</span>
            <span class="token-trend ${trendClass}">${changeText}</span>
          </div>
        </div>
      `;
      
      assetHTML += cardHTML;
    });

    
    if (assetGrid) assetGrid.innerHTML = assetHTML;
    
  } catch (err) {
    console.error("Error loading prices:", err);
    if (document.getElementById("assetGrid")) document.getElementById("assetGrid").innerHTML = '<div class="error">Failed to load market data.</div>';
  }
}

async function fetchAndRenderPools() {
  try {
    const response = await fetch('/api/pools');
    if (!response.ok) throw new Error('Failed to fetch pools');
    
    const pools = await response.json();
    const poolsGrid = document.getElementById("poolsGrid");
    if (!poolsGrid) return;
    
    let poolsHTML = '';
    
    pools.forEach(pool => {
      const apyText = pool.apy != null ? `${pool.apy.toFixed(2)}%` : '--';
      const tvlText = pool.tvlUsd != null ? `$${(pool.tvlUsd / 1e6).toFixed(2)}M` : '--';
      
      const assetData = JSON.stringify({ symbol: pool.symbol, project: pool.project, apy: pool.apy, tvlUsd: pool.tvlUsd }).replace(/"/g, '&quot;');
      poolsHTML += `
        <div class="pool-card" onclick="window.triggerChatWithContext(${assetData})">
          <div class="pool-header">
            <span class="pool-name">${pool.symbol}</span>
            <span class="token-trend badge-neutral">${pool.project}</span>
          </div>
          <div class="pool-stats">
            <div class="pool-stat-col">
              <span class="panel-label">APY</span>
              <span class="pool-stat-value highlight">${apyText}</span>
            </div>
            <div class="pool-stat-col">
              <span class="panel-label">TVL</span>
              <span class="pool-stat-value">${tvlText}</span>
            </div>
          </div>
          <button class="btn-deposit" onclick="event.stopPropagation(); alert('Deposit modal coming soon!')">Deposit</button>
        </div>
      `;
    });
    
    poolsGrid.innerHTML = poolsHTML;
    
  } catch (err) {
    console.error("Error loading pools:", err);
    const poolsGrid = document.getElementById("poolsGrid");
    if (poolsGrid) poolsGrid.innerHTML = '<div class="error">Failed to load pools.</div>';
  }
}

async function renderNewsFeed() {
  const newsFeed = document.getElementById("newsFeed");
  if (!newsFeed) return;
  
  try {
    const res = await fetch('/api/news');
    if (!res.ok) throw new Error("Failed to fetch");
    const news = await res.json();

    if (!news || news.length === 0) {
      newsFeed.innerHTML = '<p class="muted-desc">No news available at the moment.</p>';
      return;
    }

    newsFeed.innerHTML = news
      .map(
        (item) => {
          const safeTitle = item.title.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
          return `
          <div class="news-card">
            ${item.imageUrl ? `<img src="${item.imageUrl}" alt="News thumbnail" class="news-thumb" />` : ''}
            <div class="news-content">
              <h3 class="news-headline">${item.title}</h3>
              <p class="news-snippet">${item.snippet}</p>
              <div class="news-meta">
                <span class="news-meta-source">${item.source}</span>
                <span>${new Date(item.createdAt?._seconds * 1000 || item.createdAt || Date.now()).toLocaleDateString()}</span>
              </div>
              <div class="news-actions">
                <a href="${item.url}" target="_blank" class="news-btn-source">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                  Read Source
                </a>
                <button class="news-btn-ask" onclick="askCopilotAboutNews('${safeTitle}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  Ask Copilot
                </button>
              </div>
            </div>
          </div>
        `;
        }
      )
      .join("");
  } catch (e) {
    newsFeed.innerHTML = '<div class="error">Failed to load news.</div>';
    console.error(e);
  }
}

window.askCopilotAboutNews = function(newsTitle) {
  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("chatSendBtn");
  if (chatInput && chatSendBtn) {
    chatInput.value = `Поясни мені детальніше цю новину: ${newsTitle}`;
    chatSendBtn.click();
    chatInput.scrollIntoView({ behavior: 'smooth' });
  }
};

async function fetchAndRenderPortfolioSummary() {
  let sessionId = localStorage.getItem("chatSessionId");
  if (!sessionId) return;
  
  try {
    const portRes = await fetch(`/api/portfolio?sessionId=${sessionId}`);
    const priceRes = await fetch('/api/rwa-prices');
    
    if (!portRes.ok || !priceRes.ok) return;
    
    const portfolio = await portRes.json();
    const prices = await priceRes.json();
    
    if (!Array.isArray(portfolio) || portfolio.length === 0) {
      document.getElementById("dashTotalBalance").textContent = "$0.00";
      document.getElementById("dashTotalChange").innerHTML = '<span style="font-size: 13px; font-weight: normal; color: var(--text-muted);">No assets yet. Click to build.</span>';
      return;
    }
    
    let totalUsd = 0;
    let totalChangeUsd = 0;
    
    portfolio.forEach(p => {
      const liveAsset = prices.find(a => a.ticker === p.ticker);
      if (liveAsset) {
        const currentUsd = p.amount * liveAsset.price;
        totalUsd += currentUsd;
        
        if (liveAsset.change24h != null) {
           const previousValue = currentUsd / (1 + (liveAsset.change24h / 100));
           totalChangeUsd += (currentUsd - previousValue);
        }
      } else {
        totalUsd += p.valueUsd || 0;
      }
    });
    
    document.getElementById("dashTotalBalance").textContent = `$${totalUsd.toFixed(2)}`;
    
    if (totalChangeUsd !== 0) {
      const isPositive = totalChangeUsd >= 0;
      const sign = isPositive ? "+" : "";
      const pctChange = (totalChangeUsd / Math.abs(totalUsd - totalChangeUsd)) * 100;
      
      document.getElementById("dashTotalChange").innerHTML = `
        <span class="${isPositive ? 'token-trend trend-up' : 'token-trend trend-down'}" style="font-size: 14px;">
          ${sign}$${Math.abs(totalChangeUsd).toFixed(2)} (${sign}${pctChange.toFixed(2)}%)
        </span>
      `;
    }
    
    document.getElementById("dashEstYield").innerHTML = `<span class="token-trend badge-neutral" style="font-size: 14px;">~ 5.2% APY</span>`;
    
  } catch (err) {
    console.error("Failed to render portfolio summary", err);
  }
}

function loadDashboard() {
  fetchAndRenderPortfolioSummary();
  fetchAndRenderPrices();
  fetchAndRenderPools();
  renderNewsFeed();
  setupChat();
  
  // Refresh prices every 30 seconds
  setInterval(() => {
    fetchAndRenderPortfolioSummary();
    fetchAndRenderPrices();
    fetchAndRenderPools();
  }, 30000);
}

function setupChat() {
  let sessionId = localStorage.getItem("chatSessionId");
  if (!sessionId) {
    sessionId = "session-" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("chatSessionId", sessionId);
  }

  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("chatSendBtn");
  const chatMessages = document.getElementById("chatMessages");
  const chatSuggestions = document.getElementById("chatSuggestions");

  if (!chatInput || !chatSendBtn || !chatMessages) return;

  function renderSuggestions(suggestions) {
    if (!chatSuggestions) return;
    chatSuggestions.innerHTML = "";
    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) return;

    suggestions.forEach(sug => {
      const btn = document.createElement("button");
      btn.className = "chat-suggestion-btn";
      btn.textContent = sug;
      btn.onclick = () => {
        chatInput.value = sug;
        handleSend();
        chatSuggestions.innerHTML = "";
      };
      chatSuggestions.appendChild(btn);
    });
  }

  function addMessage(text, isUser) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${isUser ? "bubble-user" : "bubble-bot"}`;
    if (isUser) {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = typeof marked !== 'undefined' ? marked.parse(text) : text;
    }
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Завантажуємо історію
  fetch(`/api/chat/history?sessionId=${sessionId}`)
    .then(res => res.json())
    .then(history => {
      if (Array.isArray(history)) {
        history.forEach(m => {
          if (m.content) {
            let text = m.content;
            if (m.role === "assistant") {
              try {
                const parsed = JSON.parse(m.content);
                text = parsed.reply || m.content;
              } catch(e) {}
            }
            addMessage(text, m.role === "user");
          }
        });
      }
    })
    .catch(err => console.error("Failed to load chat history", err));

  async function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    // User message
    addMessage(text, true);
    chatInput.value = "";

    // Clear old suggestions
    renderSuggestions([]);

    // Show loading
    const loadingId = "loading-" + Date.now();
    const loadingBubble = document.createElement("div");
    loadingBubble.id = loadingId;
    loadingBubble.className = "chat-bubble bubble-bot";
    loadingBubble.innerHTML = "<p>...</p>";
    chatMessages.appendChild(loadingBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionId }),
      });
      
      const data = await response.json();
      
      // Remove loading bubble
      document.getElementById(loadingId).remove();
      
      // Add real reply
      addMessage(data.reply || "Помилка сервера", false);
      
      // Render suggestions if any
      if (data.suggestions) {
        renderSuggestions(data.suggestions);
      }
    } catch (err) {
      document.getElementById(loadingId).remove();
      addMessage("Не вдалося зв'язатися з ШІ.", false);
    }
  }

  window.triggerChatWithContext = async function(assetData) {
    const text = `Asset analysis: ${assetData.ticker || assetData.symbol}`;
    addMessage(text, true);
    
    renderSuggestions([]);

    const loadingId = "loading-" + Date.now();
    const loadingBubble = document.createElement("div");
    loadingBubble.id = loadingId;
    loadingBubble.className = "chat-bubble bubble-bot";
    loadingBubble.innerHTML = "<p>... analyzing context ...</p>";
    chatMessages.appendChild(loadingBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: text, 
          sessionId: sessionId,
          contextTrigger: {
            type: "CONTEXT_TRIGGER",
            data: assetData
          }
        }),
      });
      
      const data = await response.json();
      document.getElementById(loadingId).remove();
      addMessage(data.reply || "Помилка сервера", false);
      if (data.suggestions) renderSuggestions(data.suggestions);
    } catch (err) {
      document.getElementById(loadingId).remove();
      addMessage("Не вдалося зв'язатися з ШІ.", false);
    }
  };

  chatSendBtn.addEventListener("click", handleSend);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSend();
  });
}

loadDashboard();
