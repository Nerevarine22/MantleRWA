import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";

// 1. Ініціалізація сервера
const server = new Server(
  {
    name: "mantle-rwa-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 2. Реєстрація інструментів (tools)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_asset_data",
        description: "Отримує поточну ціну та зміну за 24 години для вказаного активу через DeFiLlama API",
        inputSchema: {
          type: "object",
          properties: {
            ticker: {
              type: "string",
              description: "Тікер активу (наприклад: coingecko:backed-tesla, mantle:0x...)",
            },
          },
          required: ["ticker"],
        },
      },
      {
        name: "get_defi_opportunities",
        description: "Повертає список актуальних фармінг-стратегій для вказаного протоколу на Mantle",
        inputSchema: {
          type: "object",
          properties: {
            protocol: {
              type: "string",
              description: "Назва протоколу (наприклад: merchant-moe, treehouse)",
            },
          },
          required: ["protocol"],
        },
      },
      {
        name: "query_knowledge_base",
        description: "Шукає інформацію про інвестиції (RWA, DeFi) у локальній базі знань (knowledge_base.txt)",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "Ключове слово або тема для пошуку (наприклад: RWA, фармінг)",
            },
          },
          required: ["topic"],
        },
      },
    ],
  };
});

// 3. Логіка виконання інструментів
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_asset_data") {
      const ticker = String(args?.ticker);
      
      const response = await fetch(`https://coins.llama.fi/prices/current/${ticker}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const coinData = data.coins?.[ticker];

      if (!coinData) {
        return {
          content: [{ type: "text", text: `Не знайдено даних для тікера ${ticker}` }],
          isError: true,
        };
      }

      const result = `Актив: ${coinData.symbol}\nЦіна: $${coinData.price}\nДостовірність: ${coinData.confidence}`;
      return { content: [{ type: "text", text: result }] };
    }

    if (name === "get_defi_opportunities") {
      const protocol = String(args?.protocol).toLowerCase();
      let strategies = "";

      if (protocol.includes("moe")) {
        strategies = "1. Надання ліквідності mETH/WETH (APY ~12%)\n2. Стейкінг $MOE для отримання veMOE (APY ~20%)";
      } else if (protocol.includes("treehouse")) {
        strategies = "1. tETH стейкінг (Оптимізація базової прибутковості LST)";
      } else {
        strategies = `Немає відомих стратегій для протоколу ${protocol} в системі.`;
      }

      return { content: [{ type: "text", text: strategies }] };
    }

    if (name === "query_knowledge_base") {
      const topic = String(args?.topic).toLowerCase();
      
      const kbPath = path.join(__dirname, "..", "knowledge_base.txt");
      const kbContent = await fs.readFile(kbPath, "utf-8");
      
      const paragraphs = kbContent.split("\n\n");
      const relevant = paragraphs.filter(p => p.toLowerCase().includes(topic));
      
      if (relevant.length === 0) {
        return { content: [{ type: "text", text: `Нічого не знайдено про "${topic}" у базі знань.` }] };
      }

      return { content: [{ type: "text", text: relevant.join("\n\n") }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Помилка виконання інструмента: ${errMessage}` }],
      isError: true,
    };
  }
});

// 4. Підключення через Express та SSE
const app = express();
app.use(cors());

let transport: SSEServerTransport;

app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No active SSE connection");
  }
});

// Експорт для Vercel Serverless Functions
export default app;

// Запуск сервера локально, якщо це не production (Vercel)
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Mantle MCP Server running locally on http://localhost:${PORT}`);
    console.log(`SSE Endpoint: http://localhost:${PORT}/sse`);
  });
}
