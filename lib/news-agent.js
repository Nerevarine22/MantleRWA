const cron = require('node-cron');
const { db } = require('./firebase.js');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI();

async function fetchAndSaveNews() {
  console.log("📰 [News Agent] Starting daily news collection...");
  
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    console.error("❌ [News Agent] TAVILY_API_KEY is missing. Cannot fetch news.");
    return;
  }
  
  if (!db) {
    console.error("❌ [News Agent] Firebase DB not initialized. Cannot save news.");
    return;
  }

  try {
    // 1. Fetch news via Tavily
    const query = "Mantle Network OR real world assets crypto OR DeFi yield news";
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: query,
        search_depth: "advanced",
        time_range: "w", // past week
        max_results: 6,
        include_images: true
      })
    });
    
    const searchData = await res.json();
    
    if (!searchData.results || searchData.results.length === 0) {
      console.log("⚠️ [News Agent] No news found today.");
      return;
    }

    const images = searchData.images || [];
    
    // 2. Format with OpenAI to ensure good snippets and clean titles
    const articles = searchData.results.map((r, i) => {
      let hostname = "Source";
      try { hostname = new URL(r.url).hostname.replace('www.', ''); } catch(e){}
      
      return {
        title: r.title,
        url: r.url,
        snippet: r.content.substring(0, 150) + "...",
        source: hostname,
        imageUrl: images[i] || "https://images.unsplash.com/photo-1621504450181-5d156ff8b549?q=80&w=2070&auto=format&fit=crop", // fallback image
        timestamp: new Date().toISOString()
      };
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an editor for a DeFi and RWA news portal. Review the following JSON array of news articles. Clean up the titles to be professional, improve the snippets to be concise and catchy (max 120 chars), and return a valid JSON object with a key 'news' containing the cleaned array. Keep the urls and imageUrls unchanged." },
        { role: "user", content: JSON.stringify(articles) }
      ],
      response_format: { type: "json_object" }
    });

    const parsedData = JSON.parse(completion.choices[0].message.content);
    const cleanedNews = parsedData.news || articles;

    // 3. Save to Firebase
    const batch = db.batch();
    const collection = db.collection('news');
    
    cleanedNews.forEach(newsItem => {
      const docRef = collection.doc(); // Auto ID
      newsItem.createdAt = new Date();
      batch.set(docRef, newsItem);
    });

    await batch.commit();
    console.log(`✅ [News Agent] Successfully saved ${cleanedNews.length} news items to Firebase.`);
    
    // Keep only the latest 20 news items to save DB space
    cleanupOldNews();

  } catch (error) {
    console.error("❌ [News Agent] Error during news collection:", error);
  }
}

async function cleanupOldNews() {
  if (!db) return;
  try {
    const snapshot = await db.collection('news').orderBy('createdAt', 'desc').get();
    if (snapshot.size > 20) {
      const batch = db.batch();
      const docsToDelete = snapshot.docs.slice(20);
      docsToDelete.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`🧹 [News Agent] Cleaned up ${docsToDelete.length} old news items.`);
    }
  } catch (e) {
    console.error("❌ [News Agent] Error cleaning up old news:", e);
  }
}

function startNewsAgent() {
  console.log("⏰ [News Agent] Agent scheduled to run every day at 06:00 AM.");
  // Run every day at 06:00
  cron.schedule('0 6 * * *', () => {
    fetchAndSaveNews();
  });
}

module.exports = { startNewsAgent, fetchAndSaveNews };
