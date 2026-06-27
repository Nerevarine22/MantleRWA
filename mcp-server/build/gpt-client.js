"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/client/sse.js");
const openai_1 = __importDefault(require("openai"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    console.error("Помилка: OPENAI_API_KEY не знайдено у файлі .env");
    process.exit(1);
}
const openai = new openai_1.default({ apiKey: OPENAI_API_KEY });
async function main() {
    console.log("🔄 Підключення до MCP-сервера через SSE...");
    // URL вашого локального або віддаленого сервера
    // Для тестування локально: http://localhost:3001/sse
    // Для Vercel: https://your-project.vercel.app/sse
    const serverUrl = new URL("http://localhost:3001/sse");
    const transport = new sse_js_1.SSEClientTransport(serverUrl);
    const mcpClient = new index_js_1.Client({ name: "gpt-mcp-client", version: "1.0.0" }, { capabilities: {} });
    await mcpClient.connect(transport);
    console.log("✅ Підключено до MCP-сервера через SSE!");
    const { tools } = await mcpClient.listTools();
    console.log(`🛠 Знайдено інструментів: ${tools.length}`);
    const openAiTools = tools.map((tool) => ({
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
        },
    }));
    const userMessage = "Привіт! Яка поточна ціна coingecko:backed-tesla і які є стратегії для merchant-moe? Також що таке RWA згідно з нашою базою знань?";
    console.log(`\n👤 Користувач: ${userMessage}\n`);
    let messages = [{ role: "user", content: userMessage }];
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
            if (toolCall.type !== "function")
                continue;
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);
            console.log(`   👉 Виклик інструмента: ${toolName} з аргументами:`, toolArgs);
            try {
                const result = await mcpClient.callTool({
                    name: toolName,
                    arguments: toolArgs,
                });
                const resultText = result.content
                    .filter((c) => c.type === "text")
                    .map((c) => c.text)
                    .join("\n");
                console.log(`   ✅ Результат (${toolName}): Отримано дані.`);
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolName,
                    content: resultText,
                });
            }
            catch (err) {
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
    }
    else {
        console.log(`\n💬 GPT: ${responseMessage.content}`);
    }
    process.exit(0);
}
main().catch(console.error);
