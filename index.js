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

function gs(c) {
  if (!sessions[c]) sessions[c] = { step:"start",project:null,currency:null,rate:1500,deposit:"no",dateFrom:null,dateTo:null };
  return sessions[c];
}
function rs(c) { sessions[c] = { step:"start",project:null,currency:null,rate:1500,deposit:"no",dateFrom:null,dateTo:null }; }

async function sm(c, t, o) {
  var b = { chat_id:c, text:t, parse_mode:"HTML" };
  if (o) b.reply_markup = o.reply_markup;
  await fetch(API+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});
}
function kb(b) { return {reply_markup:{inline_keyboard:b}}; }
function fmt(n) { return Math.round(Number(n||0)).toString(); }

async function sGet(table,project,df,dt) {
  var u = SUPA_URL+"/rest/v1/"+table+"?project=eq."+project;
  if (df) u+="&date=gte."+df;
  if (dt) u+="&date=lte."+dt;
  var r = await fetch(u,{headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY}});
  return await r.json();
}
async function sGetCash(p) {
  var u = SUPA_URL+"/rest/v1/cash?project=eq."+p;
  var r = await fetch(u,{headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY}});
  var d = await r.json();
  return d[0]||{cashIQD:0,cashUSD:0,exchangeRate:1500};
}

function calcInCurrency(iqd, usd, currency, rate) {
  if (currency === "iqd") return Math.round(Number(iqd||0) + Number(usd||0) * rate);
  return Math.round(Number(usd||0) + Number(iqd||0) / rate);
}

async function genReport(c, s) {
  var p=s.project, df=s.dateFrom, dt=s.dateTo, cur=s.currency, rate=s.rate, withDep=s.deposit==="yes";
  var cash = await sGetCash(p);
  var exp = await sGet("expenses",p,df,dt);
  var conc = await sGet("concrete",p,df,dt);
  var sym = cur==="usd"?"$":"";
  var curL = cur==="usd"?"USD":"IQD";

  var tExp = exp.reduce(function(a,b){return a+calcInCurrency(b.amountIQD,b.amountUSD,cur,rate);},0);
  var tConcRec = conc.reduce(function(a,b){
    return a+calcInCurrency(b.currency==="iqd"?Number(b.received||0):0, b.currency==="usd"?Number(b.received||0):0, cur, rate);
  },0);
  var tConcDep = conc.reduce(function(a,b){
    return a+calcInCurrency(b.currency==="iqd"?Number(b.deposit||0):0, b.currency==="usd"?Number(b.deposit||0):0, cur, rate);
  },0);
  var tMeters = conc.reduce(function(a,b){return a+Number(b.meters||0);},0);
  var tConcTotal = withDep ? tConcRec + tConcDep : tConcRec;
  var profit = tConcTotal - tExp;

  var r = "\u2705 <b>\u06a9\u06d5\u0634\u0641 \u062d\u06cc\u0633\u0627\u0628</b>\n\n";
  r += "\uD83D\uDCC1 \u067e\u0631\u06c6\u0698\u06d5: <b>"+PROJECTS[p].name+"</b>\n";
  r += "\uD83D\uDCC5 \u0644\u06d5: <b>"+df+"</b> \u062a\u0627: <b>"+dt+"</b>\n";
  r += "\uD83D\uDCB1 \u062f\u0631\u0627\u0648: <b>"+curL+"</b> | \u0646\u0631\u062e: <b>"+fmt(rate)+"</b>\n";
  r += "\uD83D\uDD12 \u062a\u06d5\u0626\u0645\u06cc\u0646: <b>"+(withDep?"\u0628\u06d5\u06b5\u06ce":"\u0646\u06d5\u062e\u06ce\u0631")+"</b>\n\n";
  r += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n";
  r += "\uD83D\uDCB0 <b>\u0642\u0627\u0633\u06d5:</b>\n";
  r += "   \u062f\u06cc\u0646\u0627\u0631: <b>"+fmt(cash.cashIQD)+"</b>\n";
  r += "   \u062f\u06c6\u06b5\u0627\u0631: <b>$"+fmt(cash.cashUSD)+"</b>\n\n";
  r += "\uD83D\uDCCA <b>\u062e\u06d5\u0631\u062c\u06cc:</b> "+sym+"<b>"+fmt(tExp)+"</b>\n\n";
  r += "\uD83C\uDFD7 <b>\u0633\u0644\u0641\u06d5 \u0648\u06d5\u0631\u06af\u06cc\u0631\u0627\u0648:</b> "+sym+"<b>"+fmt(tConcRec)+"</b>\n";
  r += "\uD83D\uDD12 <b>\u062a\u06d5\u0626\u0645\u06cc\u0646:</b> "+sym+"<b>"+fmt(tConcDep)+"</b>\n";
  r += "\uD83D\uDCCF <b>\u0645\u06d5\u062a\u0631:</b> <b>"+fmt(tMeters)+"</b>\n\n";
  if (withDep) r += "\uD83D\uDCCA <b>\u0633\u0644\u0641\u06d5+\u062a\u06d5\u0626\u0645\u06cc\u0646:</b> "+sym+"<b>"+fmt(tConcTotal)+"</b>\n\n";
  r += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n";
  if (profit>=0) r += "\u2705 <b>\u0642\u0627\u0632\u0627\u0646\u062c: "+sym+fmt(profit)+"</b>";
  else r += "\u274C <b>\u0632\u06d5\u0631\u06d5\u0631: "+sym+fmt(Math.abs(profit))+"</b>";

  await sm(c, r);
  rs(c);
}

async function handleStart(c) {
  rs(c);
  await sm(c, "\u0633\u06b5\u0627\u0648! \u0628\u06d5\u062e\u06ce\u0631 \u0628\u06ce\u062a \u0628\u06c6 <b>Karo Group Bot</b>\n\n\u062a\u06a9\u0627\u06cc\u06d5 \u067e\u0631\u06c6\u0698\u06d5\u06cc\u06d5\u06a9 \u0647\u06d5\u06b5\u0628\u0698\u06ce\u0631\u06d5:", kb([
    [{text:"\uD83D\uDCC1 Shasti",callback_data:"project_shasti"},{text:"\uD83D\uDCC1 Surosh",callback_data:"project_surosh"}]
  ]));
}

async function handleCB(cb) {
  var c=cb.message.chat.id, d=cb.data, s=gs(c);
  fetch(API+"/answerCallbackQuery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({callback_query_id:cb.id})});

  if (d==="project_shasti"||d==="project_surosh") {
    s.project=d.replace("project_",""); s.step="password";
    await sm(c,"\u067e\u0631\u06c6\u0698\u06d5\u06cc <b>"+PROJECTS[s.project].name+"</b> \u0647\u06d5\u06b5\u0628\u0698\u06ce\u0631\u062f\u0631\u0627 \u2705\n\n\u062a\u06a9\u0627\u06cc\u06d5 \u0648\u0634\u06d5\u06cc \u0646\u0647\u06ce\u0646\u06cc \u0628\u0646\u0648\u0648\u0633\u06d5:");
    return;
  }
  if (d==="report_cash") {
    var cash=await sGetCash(s.project);
    await sm(c,"\uD83D\uDCB0 <b>\u0642\u0627\u0633\u06d5\u06cc "+PROJECTS[s.project].name+"</b>\n\n\u062f\u06cc\u0646\u0627\u0631: <b>"+fmt(cash.cashIQD)+"</b>\n\u062f\u06c6\u06b5\u0627\u0631: <b>$"+fmt(cash.cashUSD)+"</b>\n\u0646\u0631\u062e: <b>"+fmt(cash.exchangeRate)+"</b>");
    return;
  }
  if (d==="report_monthly") { s.step="m_currency"; await sm(c,"\u062f\u0631\u0627\u0648 \u0647\u06d5\u06b5\u0628\u0698\u06ce\u0631\u06d5:",kb([[{text:"\uD83C\uDDEE\uD83C\uDDF6 \u062f\u06cc\u0646\u0627\u0631",callback_data:"cur_iqd"},{text:"\uD83C\uDDFA\uD83C\uDDF8 \u062f\u06c6\u06b5\u0627\u0631",callback_data:"cur_usd"}]])); return; }
  if (d==="report_expenses") { s.step="exp_df"; await sm(c,"\u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u0633\u06d5\u0631\u06d5\u062a\u0627 \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-01</code>"); return; }
  if (d==="report_concrete") { s.step="conc_df"; await sm(c,"\u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u0633\u06d5\u0631\u06d5\u062a\u0627 \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-01</code>"); return; }

  if (d==="cur_iqd"||d==="cur_usd") { s.currency=d.replace("cur_",""); s.step="m_rate"; await sm(c,"\u0646\u0631\u062e\u06cc \u0626\u0627\u06b5\u0648\u06af\u06c6\u0695 \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>1500</code>"); return; }

  if (d==="dep_yes"||d==="dep_no") { s.deposit=d.replace("dep_",""); s.step="m_df"; await sm(c,"\u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u0633\u06d5\u0631\u06d5\u062a\u0627 \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-01</code>"); return; }
}

async function handleMsg(msg) {
  var c=msg.chat.id, t=(msg.text||"").trim();
  if (t==="/start") return handleStart(c);
  var s=gs(c);

  if (s.step==="password") {
    if (t===PROJECTS[s.project].password) {
      s.step="menu";
      await sm(c,"\u0648\u0634\u06d5\u06cc \u0646\u0647\u06ce\u0646\u06cc \u0695\u0627\u0633\u062a\u06d5 \u2705\n\n\u0686\u06cc \u062f\u06d5\u062a\u06d5\u0648\u06ce\u062a\u061f",kb([
        [{text:"\uD83D\uDCB0 \u0642\u0627\u0633\u06d5",callback_data:"report_cash"}],
        [{text:"\uD83D\uDCCA \u06a9\u06d5\u0634\u0641 \u062d\u06cc\u0633\u0627\u0628",callback_data:"report_monthly"}],
        [{text:"\uD83D\uDCDD \u062e\u06d5\u0631\u062c\u06cc\u06d5\u06a9\u0627\u0646",callback_data:"report_expenses"}],
        [{text:"\uD83C\uDFD7 \u0633\u0644\u0641\u06d5 \u06a9\u06c6\u0646\u06a9\u0631\u06ce\u062a",callback_data:"report_concrete"}]
      ]));
    } else { await sm(c,"\u26A0\uFE0F \u0648\u0634\u06d5\u06cc \u0646\u0647\u06ce\u0646\u06cc \u0647\u06d5\u06b5\u06d5\u06cc\u06d5!"); }
    return;
  }

  if (s.step==="m_rate") { s.rate=Number(t)||1500; s.step="m_dep"; await sm(c,"\u062a\u06d5\u0626\u0645\u06cc\u0646 \u0644\u06d5 \u0642\u0627\u0632\u0627\u0646\u062c\u062f\u0627 \u0647\u06d5\u0628\u06ce\u062a\u061f",kb([[{text:"\u2705 \u0628\u06d5\u06b5\u06ce \u0628\u06d5 \u062a\u06d5\u0626\u0645\u06cc\u0646\u06d5\u0648\u06d5",callback_data:"dep_yes"},{text:"\u274C \u0628\u06ce \u062a\u06d5\u0626\u0645\u06cc\u0646",callback_data:"dep_no"}]])); return; }

  if (s.step==="m_df") { s.dateFrom=t; s.step="m_dt"; await sm(c,"\u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u06a9\u06c6\u062a\u0627\u06cc\u06cc \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-24</code>"); return; }
  if (s.step==="m_dt") { s.dateTo=t; await genReport(c,s); return; }

  if (s.step==="exp_df") { s.dateFrom=t; s.step="exp_dt"; await sm(c,"\u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u06a9\u06c6\u062a\u0627\u06cc\u06cc \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-24</code>"); return; }
  if (s.step==="exp_dt") {
    var exp=await sGet("expenses",s.project,s.dateFrom,t);
    var tI=exp.reduce(function(a,b){return a+Number(b.amountIQD||0);},0);
    var tU=exp.reduce(function(a,b){return a+Number(b.amountUSD||0);},0);
    var x="\uD83D\uDCDD <b>\u062e\u06d5\u0631\u062c\u06cc\u06d5\u06a9\u0627\u0646</b>\n\u0644\u06d5: "+s.dateFrom+" \u062a\u0627: "+t+"\n\n";
    exp.forEach(function(e){x+="\uD83D\uDD39 "+(e.date||"")+" | "+fmt(e.amountIQD)+" IQD | $"+fmt(e.amountUSD)+" | "+(e.note||"")+"\n";});
    x+="\n\u06a9\u06c6\u06cc \u062f\u06cc\u0646\u0627\u0631: <b>"+fmt(tI)+"</b>\n\u06a9\u06c6\u06cc \u062f\u06c6\u06b5\u0627\u0631: <b>$"+fmt(tU)+"</b>";
    if(!exp.length) x="\u0647\u06cc\u0686 \u062e\u06d5\u0631\u062c\u06cc\u06cc\u06d5\u06a9 \u0646\u06cc\u06cc\u06d5";
    await sm(c,x); rs(c); return;
  }

  if (s.step==="conc_df") { s.dateFrom=t; s.step="conc_dt"; await sm(c,"\u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u06a9\u06c6\u062a\u0627\u06cc\u06cc \u0628\u0646\u0648\u0648\u0633\u06d5:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-24</code>"); return; }
  if (s.step==="conc_dt") {
    var conc=await sGet("concrete",s.project,s.dateFrom,t);
    var tR=conc.reduce(function(a,b){return a+Number(b.received||0);},0);
    var tD=conc.reduce(function(a,b){return a+Number(b.deposit||0);},0);
    var tM=conc.reduce(function(a,b){return a+Number(b.meters||0);},0);
    var x="\uD83C\uDFD7 <b>\u0633\u0644\u0641\u06d5 \u06a9\u06c6\u0646\u06a9\u0631\u06ce\u062a</b>\n\u0644\u06d5: "+s.dateFrom+" \u062a\u0627: "+t+"\n\n";
    conc.forEach(function(e){x+="\uD83D\uDD39 "+(e.date||"")+" | "+fmt(e.meters)+"m | "+fmt(e.received)+" | "+(e.note||"")+"\n";});
    x+="\n\u0648\u06d5\u0631\u06af\u06cc\u0631\u0627\u0648: <b>"+fmt(tR)+"</b>\n\u062a\u06d5\u0626\u0645\u06cc\u0646: <b>"+fmt(tD)+"</b>\n\u0645\u06d5\u062a\u0631: <b>"+fmt(tM)+"</b>";
    if(!conc.length) x="\u0647\u06cc\u0686 \u062f\u0627\u062a\u0627\u06cc\u06d5\u06a9 \u0646\u06cc\u06cc\u06d5";
    await sm(c,x); rs(c); return;
  }

  await sm(c,"\u0628\u06c6 \u062f\u06d5\u0633\u062a\u067e\u06ce\u06a9\u0631\u062f\u0646 /start \u0628\u0646\u0648\u0648\u0633\u06d5");
}

app.post("/webhook/"+TOKEN,function(q,r){var u=q.body;if(u.callback_query)handleCB(u.callback_query);else if(u.message)handleMsg(u.message);r.sendStatus(200);});
app.get("/",function(q,r){r.send("Karo Bot v4");});

var PORT=process.env.PORT||3000;
app.listen(PORT,async function(){
  console.log("Server on port "+PORT);
  var U=process.env.RENDER_EXTERNAL_URL;
  if(U){var w=U+"/webhook/"+TOKEN;var r=await fetch(API+"/setWebhook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:w})});var d=await r.json();console.log("Webhook:",d);}
});