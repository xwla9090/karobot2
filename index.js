const express = require("express");
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));
const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = "176392487";
const API = "https://api.telegram.org/bot" + TOKEN;

const SUPA_URL = "https://scwgsaglnpyvkblegewd.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd2dzYWdsbnB5dmtibGVnZXdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzc4NzksImV4cCI6MjA4OTkxMzg3OX0._vqhk6WVe8J8mZhJE1G63y8Js8-_X5A5h_RvgJ0SC80";

var PROJECTS = {
  shasti: { name: "Shasti", password: "shasti123" },
  surosh: { name: "Surosh", password: "surosh123" }
};
var sessions = {};

function getSession(chatId) {
  if (!sessions[chatId]) sessions[chatId] = { step: "start", project: null, currency: null, dateFrom: null, dateTo: null };
  return sessions[chatId];
}
function resetSession(chatId) {
  sessions[chatId] = { step: "start", project: null, currency: null, dateFrom: null, dateTo: null };
}

async function sendMsg(chatId, text, opts) {
  var body = { chat_id: chatId, text: text, parse_mode: "HTML" };
  if (opts) body.reply_markup = opts.reply_markup;
  await fetch(API + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function kb(buttons) { return { reply_markup: { inline_keyboard: buttons } }; }

async function supaGet(table, project, dateFrom, dateTo) {
  var url = SUPA_URL + "/rest/v1/" + table + "?project=eq." + project;
  if (dateFrom) url += "&date=gte." + dateFrom;
  if (dateTo) url += "&date=lte." + dateTo;
  var r = await fetch(url, { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } });
  return await r.json();
}

async function supaGetCash(project) {
  var url = SUPA_URL + "/rest/v1/cash?project=eq." + project;
  var r = await fetch(url, { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } });
  var data = await r.json();
  return data[0] || { cashIQD: 0, cashUSD: 0, exchangeRate: 1500 };
}

function fmt(n) { return Math.round(Number(n || 0)).toString(); }

async function generateReport(chatId, s) {
  var p = s.project;
  var df = s.dateFrom;
  var dt = s.dateTo;
  var cash = await supaGetCash(p);
  var exp = await supaGet("expenses", p, df, dt);
  var conc = await supaGet("concrete", p, df, dt);

  var tExpIQD = exp.reduce(function(a, b) { return a + Number(b.amountIQD || 0); }, 0);
  var tExpUSD = exp.reduce(function(a, b) { return a + Number(b.amountUSD || 0); }, 0);
  var tConcRec = conc.reduce(function(a, b) { return a + Number(b.received || 0); }, 0);
  var tConcDep = conc.reduce(function(a, b) { return a + Number(b.deposit || 0); }, 0);
  var tMeters = conc.reduce(function(a, b) { return a + Number(b.meters || 0); }, 0);
  var profit = tConcRec - tExpIQD;

  var report = "\u2705 <b>\u0695\u0627\u067e\u06c6\u0631\u062a\u06cc \u06a9\u06d5\u0634\u0641 \u062d\u06cc\u0633\u0627\u0628</b>\n\n";
  report += "\uD83D\uDCC1 \u067e\u0631\u06c6\u0698\u06d5: <b>" + PROJECTS[p].name + "</b>\n";
  report += "\uD83D\uDCC5 \u0644\u06d5: <b>" + df + "</b> \u062a\u0627: <b>" + dt + "</b>\n\n";
  report += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n";
  report += "\uD83D\uDCB0 <b>\u0642\u0627\u0633\u06d5:</b>\n";
  report += "   \u062f\u06cc\u0646\u0627\u0631: <b>" + fmt(cash.cashIQD) + "</b>\n";
  report += "   \u062f\u06c6\u06b5\u0627\u0631: <b>$" + fmt(cash.cashUSD) + "</b>\n\n";
  report += "\uD83D\uDCCA <b>\u062e\u06d5\u0631\u062c\u06cc:</b>\n";
  report += "   \u062f\u06cc\u0646\u0627\u0631: <b>" + fmt(tExpIQD) + "</b>\n";
  report += "   \u062f\u06c6\u06b5\u0627\u0631: <b>$" + fmt(tExpUSD) + "</b>\n\n";
  report += "\uD83C\uDFD7 <b>\u0633\u0644\u0641\u06d5 \u06a9\u06c6\u0646\u06a9\u0631\u06ce\u062a:</b>\n";
  report += "   \u0648\u06d5\u0631\u06af\u06cc\u0631\u0627\u0648: <b>" + fmt(tConcRec) + "</b>\n";
  report += "   \u062a\u06d5\u0626\u0645\u06cc\u0646: <b>" + fmt(tConcDep) + "</b>\n";
  report += "   \u0645\u06d5\u062a\u0631: <b>" + fmt(tMeters) + "</b>\n\n";
  report += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n";
  if (profit >= 0) {
    report += "\u2705 <b>\u0642\u0627\u0632\u0627\u0646\u062c: " + fmt(profit) + "</b>";
  } else {
    report += "\u274C <b>\u0632\u06d5\u0631\u06d5\u0631: " + fmt(Math.abs(profit)) + "</b>";
  }

  await sendMsg(chatId, report);
  resetSession(chatId);
}

async function handleStart(chatId) {
  resetSession(chatId);
  await sendMsg(chatId, "\u0633\u06b5\u0627\u0648! \u0628\u06d5\u062e\u06ce\u0631 \u0628\u06ce\u062a \u0628\u06c6 <b>Karo Group Bot</b>\n\n\u062a\u06a9\u0627\u06cc\u06d5 \u067e\u0631\u06c6\u0698\u06d5\u06cc\u06d5\u06a9 \u0647\u06d5\u06b5\u0628\u0698\u06ce\u0631\u06d5:", kb([
    [{ text: "\uD83D\uDCC1 Shasti", callback_data: "project_shasti" }, { text: "\uD83D\uDCC1 Surosh", callback_data: "project_surosh" }]
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
    await sendMsg(chatId, "\u067e\u0631\u06c6\u0698\u06d5\u06cc <b>" + PROJECTS[s.project].name + "</b> \u0647\u06d5\u06b5\u0628\u0698\u06ce\u0631\u062f\u0631\u0627 \u2705\n\n\u062a\u06a9\u0627\u06cc\u06d5 \u0648\u0634\u06d5\u06cc \u0646\u0647\u06ce\u0646\u06cc \u0628\u0646\u0648\u0648\u0633\u06d5:");
    return;
  }

  if (data === "report_cash") {
    var cash = await supaGetCash(s.project);
    var txt = "\uD83D\uDCB0 <b>\u0642\u0627\u0633\u06d5\u06cc " + PROJECTS[s.project].name + "</b>\n\n";
    txt += "\u062f\u06cc\u0646\u0627\u0631: <b>" + fmt(cash.cashIQD) + "</b>\n";
    txt += "\u062f\u06c6\u06b5\u0627\u0631: <b>$" + fmt(cash.cashUSD) + "</b>\n";
    txt += "\u0646\u0631\u062e\u06cc \u062f\u06c6\u06b5\u0627\u0631: <b>" + fmt(cash.exchangeRate) + "</b>";
    await sendMsg(chatId, txt);
    return;
  }

  if (data === "report_monthly") {
    s.step = "dateFrom";
    await sendMsg(chatId, "\u062a\u06a9\u0627\u06cc\u06d5 \u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u0633\u06d5\u0631\u06d5\u062a\u0627 \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-01</code>");
    return;
  }

  if (data === "report_expenses") {
    s.step = "exp_dateFrom";
    await sendMsg(chatId, "\u062a\u06a9\u0627\u06cc\u06d5 \u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u0633\u06d5\u0631\u06d5\u062a\u0627 \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-01</code>");
    return;
  }

  if (data === "report_concrete") {
    s.step = "conc_dateFrom";
    await sendMsg(chatId, "\u062a\u06a9\u0627\u06cc\u06d5 \u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u0633\u06d5\u0631\u06d5\u062a\u0627 \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-01</code>");
    return;
  }
}

async function handleMessage(msg) {
  var chatId = msg.chat.id;
  var text = (msg.text || "").trim();
  if (text === "/start") return handleStart(chatId);
  var s = getSession(chatId);

  if (s.step === "password") {
    if (text === PROJECTS[s.project].password) {
      s.step = "menu";
      await sendMsg(chatId, "\u0648\u0634\u06d5\u06cc \u0646\u0647\u06ce\u0646\u06cc \u0695\u0627\u0633\u062a\u06d5 \u2705\n\n\u0686\u06cc \u062f\u06d5\u062a\u06d5\u0648\u06ce\u062a\u061f", kb([
        [{ text: "\uD83D\uDCB0 \u0642\u0627\u0633\u06d5", callback_data: "report_cash" }],
        [{ text: "\uD83D\uDCCA \u06a9\u06d5\u0634\u0641 \u062d\u06cc\u0633\u0627\u0628", callback_data: "report_monthly" }],
        [{ text: "\uD83D\uDCDD \u062e\u06d5\u0631\u062c\u06cc\u06d5\u06a9\u0627\u0646", callback_data: "report_expenses" }],
        [{ text: "\uD83C\uDFD7 \u0633\u0644\u0641\u06d5 \u06a9\u06c6\u0646\u06a9\u0631\u06ce\u062a", callback_data: "report_concrete" }]
      ]));
    } else {
      await sendMsg(chatId, "\u26A0\uFE0F \u0648\u0634\u06d5\u06cc \u0646\u0647\u06ce\u0646\u06cc \u0647\u06d5\u06b5\u06d5\u06cc\u06d5! \u062f\u0648\u0648\u0628\u0627\u0631\u06d5 \u0647\u06d5\u0648\u06b5 \u0628\u062f\u06d5\u0648\u06d5:");
    }
    return;
  }

  if (s.step === "dateFrom") {
    s.dateFrom = text;
    s.step = "dateTo";
    await sendMsg(chatId, "\u062a\u06a9\u0627\u06cc\u06d5 \u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u06a9\u06c6\u062a\u0627\u06cc\u06cc \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-24</code>");
    return;
  }

  if (s.step === "dateTo") {
    s.dateTo = text;
    await generateReport(chatId, s);
    return;
  }

  if (s.step === "exp_dateFrom") {
    s.dateFrom = text;
    s.step = "exp_dateTo";
    await sendMsg(chatId, "\u062a\u06a9\u0627\u06cc\u06d5 \u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u06a9\u06c6\u062a\u0627\u06cc\u06cc \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-24</code>");
    return;
  }

  if (s.step === "exp_dateTo") {
    var exp = await supaGet("expenses", s.project, s.dateFrom, text);
    var tIQD = exp.reduce(function(a, b) { return a + Number(b.amountIQD || 0); }, 0);
    var tUSD = exp.reduce(function(a, b) { return a + Number(b.amountUSD || 0); }, 0);
    var txt = "\uD83D\uDCDD <b>\u062e\u06d5\u0631\u062c\u06cc\u06d5\u06a9\u0627\u0646</b>\n";
    txt += "\u0644\u06d5: " + s.dateFrom + " \u062a\u0627: " + text + "\n\n";
    exp.forEach(function(e) {
      txt += "\uD83D\uDD39 " + (e.date || "") + " | " + fmt(e.amountIQD) + " IQD | $" + fmt(e.amountUSD) + " | " + (e.note || "") + "\n";
    });
    txt += "\n\u06a9\u06c6\u06cc \u062f\u06cc\u0646\u0627\u0631: <b>" + fmt(tIQD) + "</b>\n\u06a9\u06c6\u06cc \u062f\u06c6\u06b5\u0627\u0631: <b>$" + fmt(tUSD) + "</b>";
    if (exp.length === 0) txt = "\u0647\u06cc\u0686 \u062e\u06d5\u0631\u062c\u06cc\u06cc\u06d5\u06a9 \u0646\u06cc\u06cc\u06d5 \u0644\u06d5\u0645 \u0645\u0627\u0648\u06d5\u06cc\u06d5\u062f\u0627";
    await sendMsg(chatId, txt);
    resetSession(chatId);
    return;
  }

  if (s.step === "conc_dateFrom") {
    s.dateFrom = text;
    s.step = "conc_dateTo";
    await sendMsg(chatId, "\u062a\u06a9\u0627\u06cc\u06d5 \u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u06a9\u06c6\u062a\u0627\u06cc\u06cc \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-24</code>");
    return;
  }

  if (s.step === "conc_dateTo") {
    var conc = await supaGet("concrete", s.project, s.dateFrom, text);
    var tRec = conc.reduce(function(a, b) { return a + Number(b.received || 0); }, 0);
    var tDep = conc.reduce(function(a, b) { return a + Number(b.deposit || 0); }, 0);
    var tM = conc.reduce(function(a, b) { return a + Number(b.meters || 0); }, 0);
    var txt = "\uD83C\uDFD7 <b>\u0633\u0644\u0641\u06d5 \u06a9\u06c6\u0646\u06a9\u0631\u06ce\u062a</b>\n";
    txt += "\u0644\u06d5: " + s.dateFrom + " \u062a\u0627: " + text + "\n\n";
    conc.forEach(function(c) {
      txt += "\uD83D\uDD39 " + (c.date || "") + " | " + fmt(c.meters) + "m | " + fmt(c.received) + " | " + (c.note || "") + "\n";
    });
    txt += "\n\u0648\u06d5\u0631\u06af\u06cc\u0631\u0627\u0648: <b>" + fmt(tRec) + "</b>\n\u062a\u06d5\u0626\u0645\u06cc\u0646: <b>" + fmt(tDep) + "</b>\n\u0645\u06d5\u062a\u0631: <b>" + fmt(tM) + "</b>";
    if (conc.length === 0) txt = "\u0647\u06cc\u0686 \u062f\u0627\u062a\u0627\u06cc\u06d5\u06a9 \u0646\u06cc\u06cc\u06d5 \u0644\u06d5\u0645 \u0645\u0627\u0648\u06d5\u06cc\u06d5\u062f\u0627";
    await sendMsg(chatId, txt);
    resetSession(chatId);
    return;
  }

  await sendMsg(chatId, "\u0628\u06c6 \u062f\u06d5\u0633\u062a\u067e\u06ce\u06a9\u0631\u062f\u0646 /start \u0628\u0646\u0648\u0648\u0633\u06d5");
}

app.post("/webhook/" + TOKEN, function(req, res) {
  var update = req.body;
  if (update.callback_query) handleCallback(update.callback_query);
  else if (update.message) handleMessage(update.message);
  res.sendStatus(200);
});

app.get("/", function(req, res) { res.send("Karo Group Bot v3 - Supabase connected"); });

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