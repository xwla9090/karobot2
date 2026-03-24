const express = require("express");
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));
const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = "176392487";
const API = "https://api.telegram.org/bot" + TOKEN;

const PROJECTS = {
  shasti: { name: "Shasti", password: "shasti123" },
  surosh: { name: "Surosh", password: "surosh123" }
};

const sessions = {};

function getSession(chatId) {
  if (!sessions[chatId]) {
    sessions[chatId] = { step: "start", project: null, currency: null, rate: null, insurance: null };
  }
  return sessions[chatId];
}

function resetSession(chatId) {
  sessions[chatId] = { step: "start", project: null, currency: null, rate: null, insurance: null };
}

async function sendMsg(chatId, text, opts) {
  var body = { chat_id: chatId, text: text, parse_mode: "HTML" };
  if (opts) body.reply_markup = opts.reply_markup;
  await fetch(API + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function kb(buttons) {
  return { reply_markup: { inline_keyboard: buttons } };
}

async function handleStart(chatId) {
  resetSession(chatId);
  await sendMsg(chatId, "Slaw! Baxer bet bo <b>Karo Group Bot</b>\n\nTkaye projayak hellbjere:", kb([
    [{ text: "Shasti", callback_data: "project_shasti" }, { text: "Surosh", callback_data: "project_surosh" }]
  ]));
}

async function showConfirm(chatId, s) {
  var p = PROJECTS[s.project];
  var c = s.currency === "IQD" ? "Dinar (IQD)" : "Dollar (USD)";
  var txt = "Puxtay zaniyaryakan:\n\nProje: <b>" + p.name + "</b>\nDraw: <b>" + c + "</b>\nNrxi alwgor: <b>" + s.rate + "</b>\nTamin: <b>" + s.insurance + "</b>\n\nDlnyayt?";
  await sendMsg(chatId, txt, kb([
    [{ text: "Bale tawawa", callback_data: "confirm_yes" }, { text: "Na hallwashandnawa", callback_data: "confirm_no" }]
  ]));
}

async function handleCallback(cb) {
  var chatId = cb.message.chat.id;
  var data = cb.data;
  var s = getSession(chatId);
  fetch(API + "/answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: cb.id }) });

  if (data === "project_shasti" || data === "project_surosh") {
    s.project = data.replace("project_", "");
    s.step = "password";
    await sendMsg(chatId, "Projay <b>" + PROJECTS[s.project].name + "</b> hellbjerdra\n\nTkaye wshay nheni bnuwse:");
    return;
  }
  if (data === "currency_IQD" || data === "currency_USD") {
    s.currency = data.replace("currency_", "");
    s.step = "rate";
    await sendMsg(chatId, "Draw hellbjerdra\n\nTkaye nrxi alwgor bnuwse:");
    return;
  }
  if (data === "insurance_yes") { s.insurance = "Bale"; s.step = "confirm"; await showConfirm(chatId, s); return; }
  if (data === "insurance_no") { s.insurance = "Naxer"; s.step = "confirm"; await showConfirm(chatId, s); return; }
  if (data === "confirm_yes") {
    var p = PROJECTS[s.project];
    var c = s.currency === "IQD" ? "Dinar (IQD)" : "Dollar (USD)";
    var report = "Raport:\n\nProje: <b>" + p.name + "</b>\nDraw: <b>" + c + "</b>\nNrx: <b>" + s.rate + "</b>\nTamin: <b>" + s.insurance + "</b>";
    await sendMsg(chatId, report);
    if (String(chatId) !== ADMIN_CHAT_ID) { await sendMsg(ADMIN_CHAT_ID, "Raport nwe:\n" + report); }
    resetSession(chatId);
    return;
  }
  if (data === "confirm_no") { resetSession(chatId); await sendMsg(chatId, "Hallweshandrawa. /start bnuwse."); return; }
}

async function handleMessage(msg) {
  var chatId = msg.chat.id;
  var text = (msg.text || "").trim();
  if (text === "/start") { return handleStart(chatId); }
  var s = getSession(chatId);
  if (s.step === "password") {
    if (text === PROJECTS[s.project].password) {
      s.step = "currency";
      await sendMsg(chatId, "Wshay nheni raste\n\nDraw hellbjere:", kb([
        [{ text: "Dinar (IQD)", callback_data: "currency_IQD" }, { text: "Dollar (USD)", callback_data: "currency_USD" }]
      ]));
    } else {
      await sendMsg(chatId, "Wshay nheni halaye! Dwbare hawl bdewe:");
    }
    return;
  }
  if (s.step === "rate") {
    s.rate = text;
    s.step = "insurance";
    await sendMsg(chatId, "Nrx tomar kra\n\nTamin haye?", kb([
      [{ text: "Bale ba tamin", callback_data: "insurance_yes" }, { text: "Naxer be tamin", callback_data: "insurance_no" }]
    ]));
    return;
  }
  await sendMsg(chatId, "Bo dastpekrdn /start bnuwse");
}

app.post("/webhook/" + TOKEN, function(req, res) {
  var update = req.body;
  if (update.callback_query) { handleCallback(update.callback_query); }
  else if (update.message) { handleMessage(update.message); }
  res.sendStatus(200);
});

app.get("/", function(req, res) { res.send("Karo Group Bot is running"); });

var PORT = process.env.PORT || 3000;
app.listen(PORT, async function() {
  console.log("Server running on port " + PORT);
  var URL = process.env.RENDER_EXTERNAL_URL;
  if (URL) {
    var wh = URL + "/webhook/" + TOKEN;
    var r = await fetch(API + "/setWebhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: wh }) });
    var d = await r.json();
    console.log("Webhook set:", d);
  }
});