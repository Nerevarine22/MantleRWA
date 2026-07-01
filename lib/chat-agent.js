const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const OpenAI = require("openai");
require("dotenv").config();
const { db } = require("./firebase.js");
const { getTokenPrice, getRwaWatchlist, getMantlePools } = require("./mantle-tools.js");

const localTools = [
  {
    type: "function",
    function: {
      name: "getTokenPrice",
      description: "Get real-time price of a specific token using its contract address or ID",
      parameters: {
        type: "object",
        properties: {
          contract_address: { type: "string", description: "The token ID or contract address (e.g. coingecko:backed-tesla)" }
        },
        required: ["contract_address"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getRwaWatchlist",
      description: "Get current prices and data for the RWA watchlist (tokenized stocks, treasuries)",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getMantlePools",
      description: "Get a list of the top RWA-related DeFi Yield pools on Mantle (e.g. USDY, tokenized stocks)",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "webSearch",
      description: "Search the internet for current news, market events, or any real-time information about RWA, DeFi, Mantle, stocks, or any financial topic. Use this whenever the user asks about recent news, current events, or information that may have changed recently.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query to look up on the web" }
        },
        required: ["query"]
      }
    }
  }
];

let mcpClient = null;
let openai = null;
let openAiTools = [...localTools];

async function getChatResponse(userMessage, sessionId = "default-session", contextTrigger = null) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your_openai_api_key_here") {
    return "🚨 Помилка: OPENAI_API_KEY не налаштовано! Відкрийте файл .env у корені проекту та вставте ваш ключ.";
  }

  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // Ініціалізуємо MCP клієнт лише один раз
  if (!mcpClient) {
    try {
      // Підключаємось до нашого MCP-сервера, який працює на 3001 порту
      const serverUrl = new URL("http://localhost:3001/sse");
      const transport = new SSEClientTransport(serverUrl);
      mcpClient = new Client({ name: "web-chat-client", version: "1.0.0" }, { capabilities: {} });
      await mcpClient.connect(transport);

      const { tools } = await mcpClient.listTools();
      const mcpAiTools = tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));
      // Combine local and MCP tools
      openAiTools = [...localTools, ...mcpAiTools];
      console.log("✅ Chat Agent: MCP Tools loaded successfully!");
    } catch (e) {
      console.error("⚠️ Chat Agent: Failed to connect to MCP server (is it running on port 3001?):", e.message);
      // Якщо сервер не знайдено, ми просто продовжуємо без інструментів (тільки базовий GPT)
    }
  }

  let systemContent = `You are a financial Copilot, an expert in the Mantle ecosystem, RWA (Real World Assets), and DeFi. 
[USER PROFILE]: Target investment horizon - 5 years. Medium risk tolerance. Building a portfolio for long-term holding and stable passive income with moderate growth potential.

If you have access to tools, always use them to check precise asset prices or strategies before responding.
CRITICALLY IMPORTANT: You HAVE DIRECT INTERNET ACCESS via the 'webSearch' tool. NEVER say that you don't have internet access, cannot search for information, or that your data is limited to 2023. If asked about breaking news, current prices, or events — YOU MUST IMMEDIATELY call the webSearch tool.
IMPORTANT: You MUST respond in the exact same language as the user's message (ignoring any hidden system triggers). If the user writes "Asset analysis:", reply in English. If they say "Привіт", reply in Ukrainian. Be concise and professional.
IMPORTANT: You MUST ALWAYS respond in a JSON object format. Format:
{
  "reply": "Your response to the user in Markdown format",
  "suggestions": ["Question 1", "Question 2"]
}
In the suggestions array, add 2-3 short follow-up questions or remarks that logically flow from the conversation context and that the USER might ask you (phrased from the user's first-person perspective. For example: "Tell me more about this asset", "What are the risks?", "Add this to my portfolio").
IMPORTANT: Never write the tool name directly in the message text (e.g., [getTokenPrice(...)]). Use only the native function calling mechanism (Tool Calling).
IMPORTANT: For the getTokenPrice tool, the user might refer to assets simply as "tesla" or "nvidia". You must map them to the correct contract_address:
- Tesla -> coingecko:backed-tesla
- Nvidia -> coingecko:bndva-backed-nvidia
- Microsoft -> coingecko:backed-microsoft
- S&P 500 / CSPX -> coingecko:backed-cspx-core-s-p-500
- Coinbase -> coingecko:backed-coinbase-global
- MicroStrategy -> coingecko:backed-microstrategy
- Alphabet / Google -> coingecko:backed-alphabet-class-a
- GameStop -> coingecko:backed-gamestop-corp`;

  if (db) {
    try {
      const kbSnapshot = await db.collection("knowledge_base").get();
      if (!kbSnapshot.empty) {
        let kbText = "\n\nAdditional Knowledge Base:\n";
        kbSnapshot.forEach(doc => {
          kbText += `- ${doc.data().text || doc.data().content}\n`;
        });
        systemContent += kbText;
      }
    } catch (e) {
      console.error("Firebase KB Error:", e.message);
    }
  }

  if (db && sessionId) {
    try {
      const portDoc = await db.collection("portfolios").doc(sessionId).get();
      if (portDoc.exists) {
        const assets = portDoc.data().assets || [];
        if (assets.length > 0) {
          let portText = "\n\n=== ДАНІ ПРО ПОРТФОЛІО КОРИСТУВАЧА ===\nКористувач успішно сформував портфель і зараз володіє наступними активами:\n";
          let totalValue = 0;
          assets.forEach(a => {
            portText += `- ${a.ticker}: ${a.amount} шт. на суму $${(a.valueUsd || 0).toFixed(2)}\n`;
            totalValue += (a.valueUsd || 0);
          });
          portText += `Загальна оціночна вартість портфеля: $${totalValue.toFixed(2)}\nУВАГА КОПАЙЛОТУ: ТИ ПОВИНЕН БАЧИТИ ЦЕ ПОРТФОЛІО. Якщо користувач питає про своє портфоліо або просить пораду щодо нього, обов'язково проаналізуй ці активи. НІКОЛИ не кажи, що ти не бачиш портфоліо!\n=======================================\n`;
          systemContent += portText;
        }
      }
    } catch (e) {
      console.error("Firebase Portfolio Context Error:", e.message);
    }
  }

  let messages = [
    { role: "system", content: systemContent }
  ];

  if (db && sessionId) {
    try {
      const chatDoc = await db.collection("chats").doc(sessionId).get();
      if (chatDoc.exists) {
        const history = chatDoc.data().messages || [];
        messages = messages.concat(history.filter(m => m.role !== "system"));
      }
    } catch (e) {
      console.error("Firebase Chat History Error:", e.message);
    }
  }

  let finalUserMessage = userMessage;
  if (contextTrigger) {
    const assetStr = JSON.stringify(contextTrigger.data);
    finalUserMessage = `[System trigger: The user just clicked on an asset card. Asset data: ${assetStr}. Considering the user profile, analyze this asset and give recommendations. IMPORTANT: Reply in the same language as the user's message below.]\n\nUser Message: ${userMessage}`;
  }

  messages.push({ role: "user", content: finalUserMessage });

  const reqObj = {
    model: "gpt-4o",
    messages: messages,
    response_format: { type: "json_object" }
  };

  if (openAiTools.length > 0) {
    reqObj.tools = openAiTools;
  }

  try {
    const response = await openai.chat.completions.create(reqObj);
    const responseMessage = response.choices[0].message;
    messages.push(responseMessage);

    // Якщо GPT запросив виклик інструменту
    if (responseMessage.tool_calls) {
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.type !== "function") continue;
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        try {
          let resultText = "";

          if (toolName === "getTokenPrice") {
            const data = await getTokenPrice(toolArgs.contract_address);
            resultText = JSON.stringify(data);
          } else if (toolName === "getRwaWatchlist") {
            const data = await getRwaWatchlist();
            resultText = JSON.stringify(data);
          } else if (toolName === "getMantlePools") {
            const data = await getMantlePools();
            resultText = JSON.stringify(data);
          } else if (toolName === "webSearch") {
            const tavilyKey = process.env.TAVILY_API_KEY;
            if (!tavilyKey) {
              resultText = "Error: TAVILY_API_KEY is not set in .env";
            } else {
              const searchRes = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  api_key: tavilyKey,
                  query: toolArgs.query,
                  search_depth: "basic",
                  max_results: 5,
                  include_answer: true,
                  include_raw_content: false
                })
              });
              const searchData = await searchRes.json();
              // Форматуємо результат: AI summary + топ результати
              const answer = searchData.answer ? `Summary: ${searchData.answer}\n\n` : "";
              const results = (searchData.results || []).map((r, i) =>
                `[${i+1}] ${r.title}\nURL: ${r.url}\n${r.content?.slice(0, 300)}...`
              ).join("\n\n");
              resultText = answer + results;
            }
          } else if (mcpClient) {
            const result = await mcpClient.callTool({
              name: toolName,
              arguments: toolArgs,
            });

            resultText = result.content
              .filter((c) => c.type === "text")
              .map((c) => c.text)
              .join("\n");
          } else {
            resultText = "Error: Tool not found locally and MCP is not connected.";
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolName,
            content: resultText,
          });
        } catch (err) {
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolName,
            content: `Error: ${err.message}`,
          });
        }
      }

      // Фінальний запит після інструментів
      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        response_format: { type: "json_object" }
      });

      messages.push(finalResponse.choices[0].message);
      if (db && sessionId) {
        await db.collection("chats").doc(sessionId).set({ messages: messages.filter(m => m.role !== "system"), updatedAt: new Date() });
      }

      return JSON.parse(finalResponse.choices[0].message.content);
    } else {
      if (db && sessionId) {
        await db.collection("chats").doc(sessionId).set({ messages: messages.filter(m => m.role !== "system"), updatedAt: new Date() });
      }
      return JSON.parse(responseMessage.content);
    }
  } catch (err) {
    console.error("OpenAI Error:", err);
    return `Помилка GPT: ${err.message}`;
  }
}

async function getChatHistory(sessionId) {
  if (db && sessionId) {
    try {
      const chatDoc = await db.collection("chats").doc(sessionId).get();
      if (chatDoc.exists) {
        return chatDoc.data().messages || [];
      }
    } catch (e) {
      console.error("Firebase Chat History Error:", e.message);
    }
  }
  return [];
}

module.exports = { getChatResponse, getChatHistory };
