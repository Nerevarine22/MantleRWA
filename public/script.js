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
  renderNewsFeed();
  setupChat();
  
  // Refresh prices every 30 seconds
  setInterval(fetchAndRenderPrices, 30000);
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

  if (!chatInput || !chatSendBtn || !chatMessages) return;

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
            addMessage(m.content, m.role === "user");
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
