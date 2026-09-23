require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const token = process.env.BOT_TOKEN;
if (!token || token.includes("PASTE_")) {
  console.error("BOT_TOKEN is missing. Put your BotFather token in .env");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

bot.onText(/^\/start$/, async (msg) => {
  const name = msg.from.first_name || "বন্ধু";
  await bot.sendMessage(msg.chat.id,
`👋 স্বাগতম, ${name}!

🤖 আপনার SMM Bot প্রস্তুত।

নিচের মেনু থেকে শুরু করুন:`,
    {
      reply_markup: {
        keyboard: [
          [{ text: "📋 Services" }, { text: "💰 Balance" }],
          [{ text: "🛒 New Order" }, { text: "📦 My Orders" }]
        ],
        resize_keyboard: true
      }
    }
  );
});

bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;

  if (msg.text === "💰 Balance") {
    return bot.sendMessage(msg.chat.id, "💰 Balance system পরের ধাপে SMM API-এর সাথে যুক্ত করা হবে।");
  }

  if (msg.text === "📋 Services") {
    return bot.sendMessage(msg.chat.id, "📋 Service list পরের ধাপে SMM Sun API থেকে নেওয়া হবে।");
  }

  if (msg.text === "🛒 New Order") {
    return bot.sendMessage(msg.chat.id, "🛒 Order system পরের ধাপে চালু করা হবে।");
  }

  if (msg.text === "📦 My Orders") {
    return bot.sendMessage(msg.chat.id, "📦 আপনার Order history এখানে দেখানো হবে।");
  }
});

console.log("✅ Telegram bot is running...");
