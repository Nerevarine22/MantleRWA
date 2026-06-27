const refreshButton = document.getElementById("refreshButton");
const statusText = document.getElementById("statusText");

async function fetchAndRenderPrices() {
  try {
    const response = await fetch('/api/rwa-prices');
    if (!response.ok) throw new Error('Failed to fetch prices');
    
    const tokens = await response.json();
    
    const treasuriesGrid = document.getElementById("treasuriesGrid");
    const stocksGrid = document.getElementById("stocksGrid");
    
    let treasuriesHTML = '';
    let stocksHTML = '';
    
    tokens.forEach(token => {
      const isPositive = token.change24h >= 0;
      const trendClass = isPositive ? 'trend-up' : 'trend-down';
      const trendSymbol = isPositive ? '▲' : '▼';
      const changeText = token.change24h != null ? `${trendSymbol} ${Math.abs(token.change24h).toFixed(2)}%` : '--';
      const priceText = token.price != null ? `$${token.price.toFixed(2)}` : '--';
      
      const cardHTML = `
        <div class="price-card">
          <div class="card-header">
            ${token.logoUrl ? `<img src="${token.logoUrl}" alt="${token.ticker}" class="token-logo"/>` : '<div class="token-logo-placeholder"></div>'}
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
      
      if (token.category === "Stocks") {
        stocksHTML += cardHTML;
      } else {
        treasuriesHTML += cardHTML;
      }
    });
    
    treasuriesGrid.innerHTML = treasuriesHTML;
    stocksGrid.innerHTML = stocksHTML;
    
  } catch (err) {
    console.error("Error loading prices:", err);
    document.getElementById("treasuriesGrid").innerHTML = '<div class="error">Failed to load market data.</div>';
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
      
      poolsHTML += `
        <div class="price-card">
          <div class="card-header">
            <div class="token-info">
              <span class="token-symbol">${pool.symbol}</span>
              <span class="token-name">${pool.project}</span>
            </div>
          </div>
          <div class="card-body">
            <span class="token-price">${apyText}</span>
            <span class="token-trend trend-up">APY</span>
          </div>
          <div style="margin-top: 12px; font-size: 11px; color: var(--text-muted); font-family: var(--font-label); letter-spacing: 0.1em; text-transform: uppercase;">
            TVL: ${tvlText}
          </div>
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

function renderNewsFeed() {
  const newsFeed = document.getElementById("newsFeed");
  const rows = [
    ["w40", "w78", "w60"],
    ["w40", "w78", "w60"],
    ["w40", "w78", "w60"],
    ["w40", "w78", "w60"]
  ];

  newsFeed.innerHTML = rows
    .map(
      (row) => `
        <article class="news-row">
          <div class="news-line ${row[0]}"></div>
          <div class="news-line ${row[1]}"></div>
          <div class="news-line ${row[2]}"></div>
        </article>
      `
    )
    .join("");
}

function loadDashboard() {
  fetchAndRenderPrices();
  fetchAndRenderPools();
  renderNewsFeed();
  setupChat();
  
  // Refresh prices every 30 seconds
  setInterval(() => {
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
    bubble.textContent = text;
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
    loadingBubble.textContent = "...";
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

  chatSendBtn.addEventListener("click", handleSend);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSend();
  });
}

loadDashboard();
