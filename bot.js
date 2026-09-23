require("dotenv").config();

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const SMM_API_URL = process.env.SMM_API_URL || "https://my.smmsun.com/api/v2";
const SMM_API_KEY = process.env.SMM_API_KEY;
const ADMIN_ID = String(process.env.ADMIN_ID || "");
const PORT = Number(process.env.PORT) || 10000;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing.");

const bot = new TelegramBot(BOT_TOKEN);
const webhookSecret = crypto.createHash("sha256").update(BOT_TOKEN).digest("hex").slice(0, 40);
const webhookPath = `/telegram/webhook/${webhookSecret}`;

const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "settings.json");

const DEFAULT_SERVICE_IDS = [
  "979","133","174","3758","1753","622","893","2194","1850","1722","9445"
];

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch (_) {
    return {
      serviceIds: DEFAULT_SERVICE_IDS,
      prices: {},
      paymentNumbers: [],
      users: {}
    };
  }
}

let db = loadData();
if (!Array.isArray(db.serviceIds)) db.serviceIds = DEFAULT_SERVICE_IDS;
if (!db.prices) db.prices = {};
if (!Array.isArray(db.paymentNumbers)) db.paymentNumbers = [];
if (!db.users) db.users = {};
saveData();

function saveData() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
}

function isAdmin(id) {
  return ADMIN_ID && String(id) === ADMIN_ID;
}

async function smm(params = {}) {
  const body = new URLSearchParams({
    key: SMM_API_KEY || "",
    ...params
  });

  const r = await axios.post(SMM_API_URL, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 20000
  });
  return r.data;
}

async function getServices() {
  const data = await smm({ action: "services" });
  return Array.isArray(data) ? data : [];
}

function customerKeyboard(userId) {
  const rows = [
    [{ text: "📋 Services" }, { text: "💰 Balance" }],
    [{ text: "🛒 New Order" }, { text: "📦 My Orders" }]
  ];
  if (isAdmin(userId)) rows.push([{ text: "⚙️ Admin Panel" }]);
  return { keyboard: rows, resize_keyboard: true };
}

function adminKeyboard() {
  return {
    keyboard: [
      [{ text: "📋 Manage Services" }],
      [{ text: "➕ Add Service ID" }, { text: "➖ Remove Service ID" }],
      [{ text: "💰 Set Price" }, { text: "⬆️ Increase Price" }],
      [{ text: "⬇️ Decrease Price" }, { text: "💳 Payment Numbers" }],
      [{ text: "👥 User Count" }],
      [{ text: "🔙 Customer Menu" }]
    ],
    resize_keyboard: true
  };
}

const states = new Map();
function setState(id, state) { states.set(String(id), state); }
function getState(id) { return states.get(String(id)); }
function clearState(id) { states.delete(String(id)); }

function rememberUser(msg) {
  const id = String(msg.from.id);
  db.users[id] = {
    id: msg.from.id,
    username: msg.from.username || "",
    firstName: msg.from.first_name || "",
    lastSeen: new Date().toISOString()
  };
  saveData();
}

async function sendCustomerServices(chatId) {
  try {
    const all = await getServices();
    const selected = all.filter(s =>
      db.serviceIds.includes(String(s.service ?? s.id ?? ""))
    );

    if (!selected.length) {
      return bot.sendMessage(chatId,
        "⚠️ আপনার নির্বাচিত কোনো service provider API-তে পাওয়া যায়নি।");
    }

    let text = "📋 আপনার Services\n\n";
    for (const s of selected) {
      const id = String(s.service ?? s.id);
      const providerRate = Number(s.rate);
      const customPrice = db.prices[id];

      const priceText = customPrice !== undefined
        ? `💰 আপনার দাম: ${customPrice}`
        : `💰 Provider rate: ${s.rate ?? "-"}`;

      const line =
        `🆔 ${id}\n📌 ${s.name ?? "-"}\n${priceText}\n` +
        `🔢 Min: ${s.min ?? "-"} | Max: ${s.max ?? "-"}\n\n`;

      if ((text + line).length > 3500) {
        await bot.sendMessage(chatId, text);
        text = "📋 Services (continued)\n\n";
      }
      text += line;
    }

    if (text.trim()) await bot.sendMessage(chatId, text);
  } catch (e) {
    console.error("Services error:", e.response?.data || e.message);
    await bot.sendMessage(chatId, "❌ Services আনা যায়নি। Render Logs দেখুন।");
  }
}

async function manageServices(chatId) {
  const ids = db.serviceIds;
  let text = `📋 Selected Service IDs: ${ids.length}\n\n`;
  text += ids.map((id, i) =>
    `${i + 1}. ID: ${id} | Price: ${db.prices[id] ?? "Provider rate"}`
  ).join("\n");
  return bot.sendMessage(chatId, text);
}

bot.onText(/^\/start$/, async msg => {
  rememberUser(msg);
  await bot.sendMessage(
    msg.chat.id,
    "👋 স্বাগতম!\n\n🤖 Trusted BAZAAR SMM Bot\n\nনিচের মেনু থেকে অপশন নির্বাচন করুন।",
    { reply_markup: customerKeyboard(msg.from.id) }
  );
});

bot.onText(/^\/admin$/, async msg => {
  rememberUser(msg);
  if (!isAdmin(msg.from.id))
    return bot.sendMessage(msg.chat.id, "⛔ এই মেনু শুধু Admin-এর জন্য।");
  clearState(msg.from.id);
  return bot.sendMessage(msg.chat.id, "⚙️ Admin Panel", {
    reply_markup: adminKeyboard()
  });
});

bot.on("message", async msg => {
  if (!msg.text || msg.text.startsWith("/")) return;

  rememberUser(msg);

  const id = msg.chat.id;
  const uid = msg.from.id;
  const text = msg.text;

  // Admin state actions have priority.
  if (isAdmin(uid)) {
    const state = getState(uid);

    if (state?.type === "add_service") {
      const ids = text.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
      const added = [];
      for (const serviceId of ids) {
        if (!/^\d+$/.test(serviceId)) continue;
        if (!db.serviceIds.includes(serviceId)) {
          db.serviceIds.push(serviceId);
          added.push(serviceId);
        }
      }
      saveData();
      clearState(uid);
      return bot.sendMessage(
        id,
        added.length
          ? `✅ Service ID যোগ হয়েছে:\n${added.join(", ")}`
          : "⚠️ নতুন কোনো ID যোগ হয়নি।",
        { reply_markup: adminKeyboard() }
      );
    }

    if (state?.type === "remove_service") {
      const ids = text.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
      const before = db.serviceIds.length;
      db.serviceIds = db.serviceIds.filter(x => !ids.includes(x));
      ids.forEach(x => delete db.prices[x]);
      saveData();
      clearState(uid);
      return bot.sendMessage(
        id,
        `✅ ${before - db.serviceIds.length}টি Service ID বাদ দেওয়া হয়েছে।`,
        { reply_markup: adminKeyboard() }
      );
    }

    if (state?.type === "set_price") {
      const m = text.match(/^(\d+)\s+([0-9]+(?:\.[0-9]+)?)$/);
      if (!m)
        return bot.sendMessage(id, "ফরম্যাট:\nServiceID Price\nউদাহরণ: 979 150");
      const serviceId = m[1];
      if (!db.serviceIds.includes(serviceId))
        return bot.sendMessage(id, "❌ এই Service ID আপনার তালিকায় নেই।");
      db.prices[serviceId] = Number(m[2]);
      saveData();
      clearState(uid);
      return bot.sendMessage(
        id, `✅ Service ${serviceId}-এর দাম ${m[2]} সেট হয়েছে।`,
        { reply_markup: adminKeyboard() }
      );
    }

    if (state?.type === "increase_price" || state?.type === "decrease_price") {
      const m = text.match(/^(\d+)\s+([0-9]+(?:\.[0-9]+)?)$/);
      if (!m)
        return bot.sendMessage(id, "ফরম্যাট:\nServiceID Amount\nউদাহরণ: 979 20");
      const serviceId = m[1];
      if (!db.serviceIds.includes(serviceId))
        return bot.sendMessage(id, "❌ এই Service ID আপনার তালিকায় নেই।");

      const oldPrice = Number(db.prices[serviceId] ?? 0);
      const amount = Number(m[2]);
      const newPrice = state.type === "increase_price"
        ? oldPrice + amount
        : Math.max(0, oldPrice - amount);

      db.prices[serviceId] = newPrice;
      saveData();
      clearState(uid);

      return bot.sendMessage(
        id,
        `✅ Service ${serviceId}\nপুরনো দাম: ${oldPrice}\nনতুন দাম: ${newPrice}`,
        { reply_markup: adminKeyboard() }
      );
    }

    if (state?.type === "payment_add") {
      const number = text.trim();
      if (!/^[0-9+\-\s]{8,20}$/.test(number))
        return bot.sendMessage(id, "⚠️ সঠিক payment number দিন।");
      if (!db.paymentNumbers.includes(number)) db.paymentNumbers.push(number);
      saveData();
      clearState(uid);
      return bot.sendMessage(
        id, `✅ Payment number যোগ হয়েছে:\n${number}`,
        { reply_markup: adminKeyboard() }
      );
    }

    if (state?.type === "payment_remove") {
      const number = text.trim();
      db.paymentNumbers = db.paymentNumbers.filter(x => x !== number);
      saveData();
      clearState(uid);
      return bot.sendMessage(
        id, "✅ Payment number মুছে দেওয়া হয়েছে।",
        { reply_markup: adminKeyboard() }
      );
    }

    if (state?.type === "payment_menu") {
      // handled by buttons below
    }
  }

  if (text === "⚙️ Admin Panel") {
    if (!isAdmin(uid)) return bot.sendMessage(id, "⛔ অনুমতি নেই।");
    clearState(uid);
    return bot.sendMessage(id, "⚙️ Admin Panel", {
      reply_markup: adminKeyboard()
    });
  }

  if (isAdmin(uid)) {
    if (text === "📋 Manage Services") return manageServices(id);

    if (text === "➕ Add Service ID") {
      setState(uid, { type: "add_service" });
      return bot.sendMessage(id,
        "➕ Service ID যোগ করুন।\nএকটি বা একাধিক ID comma/space দিয়ে দিতে পারবেন।\nউদাহরণ:\n979,133,2000");
    }

    if (text === "➖ Remove Service ID") {
      setState(uid, { type: "remove_service" });
      return bot.sendMessage(id,
        "➖ যে Service ID বাদ দিতে চান দিন।\nউদাহরণ:\n979,133");
    }

    if (text === "💰 Set Price") {
      setState(uid, { type: "set_price" });
      return bot.sendMessage(id,
        "💰 Price সেট করুন।\nফরম্যাট: ServiceID Price\nউদাহরণ: 979 150");
    }

    if (text === "⬆️ Increase Price") {
      setState(uid, { type: "increase_price" });
      return bot.sendMessage(id,
        "⬆️ কত টাকা বাড়াবেন?\nফরম্যাট: ServiceID Amount\nউদাহরণ: 979 20");
    }

    if (text === "⬇️ Decrease Price") {
      setState(uid, { type: "decrease_price" });
      return bot.sendMessage(id,
        "⬇️ কত টাকা কমাবেন?\nফরম্যাট: ServiceID Amount\nউদাহরণ: 979 20");
    }

    if (text === "💳 Payment Numbers") {
      const nums = db.paymentNumbers.length
        ? db.paymentNumbers.map((n,i) => `${i+1}. ${n}`).join("\n")
        : "কোনো payment number যোগ করা হয়নি।";

      return bot.sendMessage(id,
        `💳 Payment Numbers\n\n${nums}\n\n` +
        `নতুন number যোগ করতে: /addpayment\n` +
        `number বাদ দিতে: /removepayment`);
    }

    if (text === "👥 User Count") {
      return bot.sendMessage(id, `👥 Registered users: ${Object.keys(db.users).length}`);
    }

    if (text === "🔙 Customer Menu") {
      clearState(uid);
      return bot.sendMessage(id, "🏠 Customer Menu", {
        reply_markup: customerKeyboard(uid)
      });
    }
  }

  if (text === "📋 Services") return sendCustomerServices(id);

  if (text === "💰 Balance") {
    try {
      const data = await smm({ action: "balance" });
      return bot.sendMessage(id,
        `💰 Provider Balance\n\nBalance: ${data.balance ?? "-"}\nCurrency: ${data.currency ?? "-"}`);
    } catch (e) {
      console.error(e.response?.data || e.message);
      return bot.sendMessage(id, "❌ Provider balance আনা যায়নি।");
    }
  }

  if (text === "🛒 New Order") {
    const payments = db.paymentNumbers.length
      ? `\n\n💳 Payment Numbers:\n${db.paymentNumbers.join("\n")}`
      : "";
    return bot.sendMessage(id,
      "🛒 New Order\n\nএই version-এ order submission/payment verification এখনো যোগ করা হয়নি।" +
      payments);
  }

  if (text === "📦 My Orders") {
    return bot.sendMessage(id,
      "📦 My Orders\n\nOrder database এখনো যোগ করা হয়নি।");
  }
});

bot.onText(/^\/addpayment$/, msg => {
  if (!isAdmin(msg.from.id))
    return bot.sendMessage(msg.chat.id, "⛔ অনুমতি নেই।");
  setState(msg.from.id, { type: "payment_add" });
  return bot.sendMessage(msg.chat.id, "💳 নতুন payment number লিখুন।");
});

bot.onText(/^\/removepayment$/, msg => {
  if (!isAdmin(msg.from.id))
    return bot.sendMessage(msg.chat.id, "⛔ অনুমতি নেই।");
  if (!db.paymentNumbers.length)
    return bot.sendMessage(msg.chat.id, "কোনো payment number নেই।");
  setState(msg.from.id, { type: "payment_remove" });
  return bot.sendMessage(
    msg.chat.id,
    `যে number মুছবেন সেটি হুবহু পাঠান:\n\n${db.paymentNumbers.join("\n")}`
  );
});

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Trusted BAZAAR Telegram SMM Bot is running.");
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === "POST" && req.url === webhookPath) {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) req.destroy();
    });
    req.on("end", async () => {
      try {
        await bot.processUpdate(JSON.parse(raw || "{}"));
      } catch (e) {
        console.error("Webhook error:", e.message);
      }
      res.writeHead(200);
      res.end("OK");
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", async () => {
  console.log(`Listening on 0.0.0.0:${PORT}`);
  if (process.env.RENDER_EXTERNAL_URL) {
    const webhookUrl = process.env.RENDER_EXTERNAL_URL + webhookPath;
    try {
      await bot.setWebHook(webhookUrl);
      console.log("Telegram webhook configured.");
    } catch (e) {
      console.error("Webhook setup failed:", e.response?.body || e.message);
    }
  }
});

process.on("SIGTERM", async () => {
  try { await bot.deleteWebHook(); } catch (_) {}
  server.close(() => process.exit(0));
});
