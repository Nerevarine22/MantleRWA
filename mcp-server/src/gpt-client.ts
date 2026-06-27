import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Помилка: OPENAI_API_KEY не знайдено у файлі .env");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function main() {
  console.log("🔄 Підключення до MCP-сервера через SSE...");
  
  // URL вашого локального або віддаленого сервера
  // Для тестування локально: http://localhost:3001/sse
  // Для Vercel: https://your-project.vercel.app/sse
  const serverUrl = new URL("http://localhost:3001/sse");
  
  const transport = new SSEClientTransport(serverUrl);

  const mcpClient = new Client(
    { name: "gpt-mcp-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await mcpClient.connect(transport);
  console.log("✅ Підключено до MCP-сервера через SSE!");

  const { tools } = await mcpClient.listTools();
  console.log(`🛠 Знайдено інструментів: ${tools.length}`);

  const openAiTools: any[] = tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));

  const userMessage = "Привіт! Яка поточна ціна coingecko:backed-tesla і які є стратегії для merchant-moe? Також що таке RWA згідно з нашою базою знань?";
  console.log(`\n👤 Користувач: ${userMessage}\n`);

  let messages: any[] = [{ role: "user", content: userMessage }];

  console.log("🤖 Запит до GPT-4o...");
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages,
    tools: openAiTools,
  });

  const responseMessage = response.choices[0].message;
  messages.push(responseMessage);

  if (responseMessage.tool_calls) {
    console.log("⚙️ GPT запросив виклик інструментів!");
    
    for (const toolCall of responseMessage.tool_calls) {
      if (toolCall.type !== "function") continue;
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);
      
      console.log(`   👉 Виклик інструмента: ${toolName} з аргументами:`, toolArgs);

      try {
        const result = await mcpClient.callTool({
          name: toolName,
          arguments: toolArgs,
        }) as any;

        const resultText = result.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("\n");

        console.log(`   ✅ Результат (${toolName}): Отримано дані.`);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolName,
          content: resultText,
        });
      } catch (err: any) {
        console.error(`   ❌ Помилка виконання ${toolName}:`, err.message);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolName,
          content: `Помилка: ${err.message}`,
        });
      }
    }

    console.log("\n🤖 Очікування фінальної відповіді від GPT...");
    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
    });

    console.log(`\n💬 GPT: ${finalResponse.choices[0].message.content}`);
  } else {
    console.log(`\n💬 GPT: ${responseMessage.content}`);
  }

  process.exit(0);
}

main().catch(console.error);
