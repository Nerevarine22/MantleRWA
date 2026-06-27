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

  let systemContent = `Ти — фінансовий Copilot, експерт з екосистеми Mantle, RWA (Real World Assets) та DeFi. 
[ПРОФІЛЬ КОРИСТУВАЧА]: Цільовий горизонт інвестування — 5 років. Середня схильність до ризику. Збирає портфель для довгострокового зберігання та стабільного пасивного доходу з помірним потенціалом росту.

Якщо в тебе є доступ до інструментів, завжди використовуй їх для перевірки точних цін на активи або стратегій перед тим, як відповідати. 
Відповідай тією ж мовою, якою до тебе звернувся користувач, лаконічно та професійно.
ВАЖЛИВО: Ти ПОВИНЕН завжди відповідати у форматі JSON об'єкта. Формат:
{
  "reply": "Твоя відповідь користувачу у форматі Markdown",
  "suggestions": ["Питання 1", "Питання 2"]
}
В масив suggestions додай 2-3 короткі питання, які логічно випливають з контексту розмови і можуть зацікавити користувача.
ВАЖЛИВО: Ніколи не пиши назву інструменту в тексті повідомлення (наприклад, [getTokenPrice(...)]). Використовуй виключно нативний механізм виклику функцій (Tool Calling).
ВАЖЛИВО: Для інструменту getTokenPrice користувач може називати активи просто "tesla" або "nvidia". Ти повинен підставити правильний contract_address:
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
        let kbText = "\n\nДодаткова база знань:\n";
        kbSnapshot.forEach(doc => {
          kbText += `- ${doc.data().text || doc.data().content}\n`;
        });
        systemContent += kbText;
      }
    } catch (e) {
      console.error("Firebase KB Error:", e.message);
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
    finalUserMessage = `[Системний тригер: Користувач щойно клікнув на картку активу. Дані активу: ${assetStr}. Враховуючи мій профіль користувача, проаналізуй цей актив та дай рекомендації.]\n\n${userMessage}`;
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
