require("dotenv").config();
const http = require("http");
const crypto = require("crypto");
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const TOKEN = process.env.BOT_TOKEN;
const API_URL = process.env.SMM_API_URL || "https://my.smmsun.com/api/v2";
const API_KEY = process.env.SMM_API_KEY;
const PORT = Number(process.env.PORT) || 10000;

if (!TOKEN) throw new Error("BOT_TOKEN is missing");

const bot = new TelegramBot(TOKEN);
const secret = crypto.createHash("sha256").update(TOKEN).digest("hex").slice(0, 40);
const webhookPath = `/telegram/webhook/${secret}`;

async function smm(params) {
  const body = new URLSearchParams({ key: API_KEY || "", ...params });
  const r = await axios.post(API_URL, body.toString(), {
    headers: {"Content-Type":"application/x-www-form-urlencoded"},
    timeout: 20000
  });
  return r.data;
}

const keyboard = {
  keyboard: [
    [{text:"📋 Services"},{text:"💰 Balance"}],
    [{text:"🛒 New Order"},{text:"📦 My Orders"}]
  ],
  resize_keyboard:true
};

bot.onText(/^\/start$/, msg =>
  bot.sendMessage(msg.chat.id,
    "👋 স্বাগতম!\n\n🤖 Telegram SMM Bot\n\nনিচের মেনু থেকে অপশন নির্বাচন করুন।",
    {reply_markup:keyboard})
);

bot.on("message", async msg => {
  if (!msg.text || msg.text.startsWith("/")) return;
  const id = msg.chat.id;

  if (msg.text === "📋 Services") {
    try {
      const data = await smm({action:"services"});
      if (!Array.isArray(data) || !data.length)
        return bot.sendMessage(id,"⚠️ কোনো service পাওয়া যায়নি। API key/URL চেক করুন।");
      const out = data.slice(0,50).map(s =>
        `🆔 ${s.service ?? s.id ?? "-"}\n📌 ${s.name ?? "-"}\n💵 Rate: ${s.rate ?? "-"}\n🔢 Min: ${s.min ?? "-"} | Max: ${s.max ?? "-"}`
      ).join("\n\n");
      return bot.sendMessage(id,`📋 Services (প্রথম ${Math.min(50,data.length)}টি)\n\n${out}`);
    } catch(e) {
      console.error(e.response?.data || e.message);
      return bot.sendMessage(id,"❌ SMM API থেকে services আনা যায়নি।");
    }
  }

  if (msg.text === "💰 Balance") {
    try {
      const data = await smm({action:"balance"});
      return bot.sendMessage(id,`💰 Provider Balance\n\nBalance: ${data.balance ?? "-"}\nCurrency: ${data.currency ?? "-"}`);
    } catch(e) {
      console.error(e.response?.data || e.message);
      return bot.sendMessage(id,"❌ Provider balance আনা যায়নি।");
    }
  }

  if (msg.text === "🛒 New Order")
    return bot.sendMessage(id,"🛒 New Order\n\nএই Render-ready starter-এ customer balance/payment/order database এখনো যোগ করা হয়নি।");

  if (msg.text === "📦 My Orders")
    return bot.sendMessage(id,"📦 My Orders\n\nOrder database এখনো যোগ করা হয়নি।");
});

const server = http.createServer((req,res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200,{"Content-Type":"text/plain; charset=utf-8"});
    return res.end("Telegram SMM Bot is running.");
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200,{"Content-Type":"application/json"});
    return res.end(JSON.stringify({ok:true}));
  }
  if (req.method === "POST" && req.url === webhookPath) {
    let raw = "";
    req.on("data", c => { raw += c; if (raw.length > 2*1024*1024) req.destroy(); });
    req.on("end", async () => {
      try { await bot.processUpdate(JSON.parse(raw || "{}")); } catch(e) { console.error(e.message); }
      res.writeHead(200); res.end("OK");
    });
    return;
  }
  res.writeHead(404); res.end("Not found");
});

server.listen(PORT,"0.0.0.0",async () => {
  console.log(`Listening on 0.0.0.0:${PORT}`);
  if (process.env.RENDER_EXTERNAL_URL) {
    const url = process.env.RENDER_EXTERNAL_URL + webhookPath;
    try { await bot.setWebHook(url); console.log("Telegram webhook configured."); }
    catch(e) { console.error("Webhook setup failed:",e.response?.body || e.message); }
  }
});

process.on("SIGTERM",async()=>{ try{await bot.deleteWebHook();}catch(_){} server.close(()=>process.exit(0)); });
