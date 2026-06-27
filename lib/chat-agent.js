const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const OpenAI = require("openai");
require("dotenv").config();
const { db } = require("./firebase.js");

let mcpClient = null;
let openai = null;
let openAiTools = [];

async function getChatResponse(userMessage, sessionId = "default-session") {
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
      openAiTools = tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));
      console.log("✅ Chat Agent: MCP Tools loaded successfully!");
    } catch (e) {
      console.error("⚠️ Chat Agent: Failed to connect to MCP server (is it running on port 3001?):", e.message);
      // Якщо сервер не знайдено, ми просто продовжуємо без інструментів (тільки базовий GPT)
    }
  }

  let systemContent = `Ти — фінансовий Copilot, експерт з екосистеми Mantle, RWA (Real World Assets) та DeFi. 
Якщо в тебе є доступ до інструментів, завжди використовуй їх для перевірки точних цін на активи або стратегій перед тим, як відповідати. 
Відповідай українською мовою лаконічно та професійно.
ВАЖЛИВО: Для інструменту get_asset_data користувач може називати активи просто "tesla" або "nvidia". Ти повинен підставити правильний ID:
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

  messages.push({ role: "user", content: userMessage });

  const reqObj = {
    model: "gpt-4o",
    messages: messages,
  };

  if (openAiTools.length > 0) {
    reqObj.tools = openAiTools;
  }

  try {
    const response = await openai.chat.completions.create(reqObj);
    const responseMessage = response.choices[0].message;
    messages.push(responseMessage);

    // Якщо GPT запросив виклик інструменту
    if (responseMessage.tool_calls && mcpClient) {
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.type !== "function") continue;
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        try {
          const result = await mcpClient.callTool({
            name: toolName,
            arguments: toolArgs,
          });

          const resultText = result.content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n");

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
      });

      messages.push(finalResponse.choices[0].message);
      if (db && sessionId) {
        await db.collection("chats").doc(sessionId).set({ messages: messages.filter(m => m.role !== "system"), updatedAt: new Date() });
      }

      return finalResponse.choices[0].message.content;
    } else {
      if (db && sessionId) {
        await db.collection("chats").doc(sessionId).set({ messages: messages.filter(m => m.role !== "system"), updatedAt: new Date() });
      }
      return responseMessage.content;
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
