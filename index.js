const express = require("express");
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));
const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const API = "https://api.telegram.org/bot" + TOKEN;
const SUPA_URL = "https://scwgsaglnpyvkblegewd.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd2dzYWdsbnB5dmtibGVnZXdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzc4NzksImV4cCI6MjA4OTkxMzg3OX0._vqhk6WVe8J8mZhJE1G63y8Js8-_X5A5h_RvgJ0SC80";
var sessions = {};

function gs(c) { if (!sessions[c]) sessions[c] = {step:"start",project:null,password:null,currency:null,rate:1500,deposit:"no",dateFrom:null,dateTo:null}; return sessions[c]; }
function rs(c) { sessions[c] = {step:"start",project:null,password:null,currency:null,rate:1500,deposit:"no",dateFrom:null,dateTo:null}; }

async function sm(c, t, o) {
  var b = {chat_id:c, text:t, parse_mode:"HTML"};
  if (o) b.reply_markup = o.reply_markup;
  await fetch(API+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});
}
function kb(b) { return {reply_markup:{inline_keyboard:b}}; }
function fmt(n) { return Math.round(Number(n) || 0).toString(); }

async function supa(path) {
  var r = await fetch(SUPA_URL+"/rest/v1/"+path,{headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY}});
  return await r.json();
}

async function getProjects() {
  var users = await supa("users?select=*&isadmin=eq.false");
  return users || [];
}

async function getProject(projectName) {
  var users = await supa("users?select=*&project=eq."+projectName);
  return users[0] || null;
}

async function handleStart(c) {
  rs(c);
  var projects = await getProjects();
  var buttons = [];
  var row = [];
  for (var i = 0; i < projects.length; i++) {
    row.push({text: "\uD83D\uDCC1 " + (projects[i].label || projects[i].project), callback_data: "project_" + projects[i].project});
    if (row.length === 2 || i === projects.length - 1) { buttons.push(row); row = []; }
  }
  await sm(c, "\u0633\u06b5\u0627\u0648! \u0628\u06d5\u062e\u06ce\u0631 \u0628\u06ce\u062a \u0628\u06c6 <b>Karo Group Bot</b>\n\n\u062a\u06a9\u0627\u06cc\u06d5 \u067e\u0631\u06c6\u0698\u06d5\u06cc\u06d5\u06a9 \u0647\u06d5\u06b5\u0628\u0698\u06ce\u0631\u06d5:", kb(buttons));
}

async function genReport(c, s) {
  var p=s.project, df=s.dateFrom, dt=s.dateTo, cur=s.currency, rate=s.rate, withDep=s.deposit==="yes";
  var cashArr = await supa("cash?select=*&project=eq."+p);
  var cash = cashArr[0] || {cashiqd:0,cashusd:0,exchangerate:1500};
  var exp = await supa("expenses?select=*&project=eq."+p+"&date=gte."+df+"&date=lte."+dt);
  var conc = await supa("concrete?select=*&project=eq."+p+"&date=gte."+df+"&date=lte."+dt);
  var sym = cur==="usd"?"$":"";

  var tExp = 0;
  for (var i=0;i<exp.length;i++) {
    var eI = Number(exp[i].amountiqd) || 0;
    var eU = Number(exp[i].amountusd) || 0;
    if (cur==="iqd") tExp += eI + eU * rate;
    else tExp += eU + eI / rate;
  }
  tExp = Math.round(tExp);

  var tConcRec=0, tConcDep=0, tMeters=0;
  for (var i=0;i<conc.length;i++) {
    var cc = conc[i].currency || "iqd";
    var rec = Number(conc[i].received) || 0;
    var dep = Number(conc[i].deposit) || 0;
    var met = Number(conc[i].meters) || 0;
    if (cur==="iqd") { tConcRec += cc==="iqd" ? rec : rec*rate; tConcDep += cc==="iqd" ? dep : dep*rate; }
    else { tConcRec += cc==="usd" ? rec : rec/rate; tConcDep += cc==="usd" ? dep : dep/rate; }
    tMeters += met;
  }
  tConcRec=Math.round(tConcRec); tConcDep=Math.round(tConcDep);
  var tConcTotal = withDep ? tConcRec + tConcDep : tConcRec;
  var profit = tConcTotal - tExp;

  var r = "\u2705 <b>\u06a9\u06d5\u0634\u0641 \u062d\u06cc\u0633\u0627\u0628</b>\n\n";
  r += "\uD83D\uDCC1 \u067e\u0631\u06c6\u0698\u06d5: <b>"+p+"</b>\n";
  r += "\uD83D\uDCC5 \u0644\u06d5: <b>"+df+"</b> \u062a\u0627: <b>"+dt+"</b>\n";
  r += "\uD83D\uDCB1 \u062f\u0631\u0627\u0648: <b>"+(cur==="usd"?"USD":"IQD")+"</b> | \u0646\u0631\u062e: <b>"+fmt(rate)+"</b>\n";
  r += "\uD83D\uDD12 \u062a\u06d5\u0626\u0645\u06cc\u0646: <b>"+(withDep?"\u0628\u06d5\u06b5\u06ce":"\u0646\u06d5\u062e\u06ce\u0631")+"</b>\n\n";
  r += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n";
  r += "\uD83D\uDCB0 <b>\u0642\u0627\u0633\u06d5:</b>\n";
  r += "   \u062f\u06cc\u0646\u0627\u0631: <b>"+fmt(cash.cashiqd)+"</b>\n";
  r += "   \u062f\u06c6\u06b5\u0627\u0631: <b>$"+fmt(cash.cashusd)+"</b>\n\n";
  r += "\uD83D\uDCCA <b>\u062e\u06d5\u0631\u062c\u06cc:</b> "+sym+"<b>"+fmt(tExp)+"</b>\n\n";
  r += "\uD83C\uDFD7 <b>\u0633\u0644\u0641\u06d5 \u0648\u06d5\u0631\u06af\u06cc\u0631\u0627\u0648:</b> "+sym+"<b>"+fmt(tConcRec)+"</b>\n";
  r += "\uD83D\uDD12 <b>\u062a\u06d5\u0626\u0645\u06cc\u0646:</b> "+sym+"<b>"+fmt(tConcDep)+"</b>\n";
  r += "\uD83D\uDCCF <b>\u0645\u06d5\u062a\u0631:</b> <b>"+fmt(tMeters)+"</b>\n\n";
  if (withDep) r += "\uD83D\uDCCA <b>\u0633\u0644\u0641\u06d5+\u062a\u06d5\u0626\u0645\u06cc\u0646:</b> "+sym+"<b>"+fmt(tConcTotal)+"</b>\n\n";
  r += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n";
  if (profit>=0) r += "\u2705 <b>\u0642\u0627\u0632\u0627\u0646\u062c: "+sym+fmt(profit)+"</b>";
  else r += "\u274C <b>\u0632\u06d5\u0631\u06d5\u0631: "+sym+fmt(Math.abs(profit))+"</b>";
  await sm(c, r); rs(c);
}

async function genExpList(c, s) {
  var exp = await supa("expenses?select=*&project=eq."+s.project+"&date=gte."+s.dateFrom+"&date=lte."+s.dateTo);
  var tI=0, tU=0;
  var txt = "\uD83D\uDCDD <b>\u062e\u06d5\u0631\u062c\u06cc\u06d5\u06a9\u0627\u0646</b>\n";
  txt += "\u0644\u06d5: "+s.dateFrom+" \u062a\u0627: "+s.dateTo+"\n\n";
  for (var i=0;i<exp.length;i++) {
    var eI = Number(exp[i].amountiqd) || 0;
    var eU = Number(exp[i].amountusd) || 0;
    tI += eI; tU += eU;
    txt += "\uD83D\uDD39 "+(exp[i].date||"")+" | "+fmt(eI)+" IQD | $"+fmt(eU)+" | "+(exp[i].note||"")+"\n";
  }
  txt += "\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n";
  txt += "\u06a9\u06c6\u06cc \u062f\u06cc\u0646\u0627\u0631: <b>"+fmt(tI)+"</b>\n";
  txt += "\u06a9\u06c6\u06cc \u062f\u06c6\u06b5\u0627\u0631: <b>$"+fmt(tU)+"</b>";
  if (!exp.length) txt = "\u0647\u06cc\u0686 \u062e\u06d5\u0631\u062c\u06cc\u06cc\u06d5\u06a9 \u0646\u06cc\u06cc\u06d5";
  await sm(c, txt); rs(c);
}

async function genConcList(c, s) {
  var conc = await supa("concrete?select=*&project=eq."+s.project+"&date=gte."+s.dateFrom+"&date=lte."+s.dateTo);
  var tR=0, tD=0, tM=0;
  var txt = "\uD83C\uDFD7 <b>\u0633\u0644\u0641\u06d5 \u06a9\u06c6\u0646\u06a9\u0631\u06ce\u062a</b>\n";
  txt += "\u0644\u06d5: "+s.dateFrom+" \u062a\u0627: "+s.dateTo+"\n\n";
  for (var i=0;i<conc.length;i++) {
    var rec = Number(conc[i].received) || 0;
    var dep = Number(conc[i].deposit) || 0;
    var met = Number(conc[i].meters) || 0;
    tR += rec; tD += dep; tM += met;
    txt += "\uD83D\uDD39 "+(conc[i].date||"")+" | "+fmt(met)+"m | "+fmt(rec)+" | \u062a\u06d5\u0626\u0645\u06cc\u0646:"+fmt(dep)+" | "+(conc[i].note||"")+"\n";
  }
  txt += "\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n";
  txt += "\u0648\u06d5\u0631\u06af\u06cc\u0631\u0627\u0648: <b>"+fmt(tR)+"</b>\n";
  txt += "\u062a\u06d5\u0626\u0645\u06cc\u0646: <b>"+fmt(tD)+"</b>\n";
  txt += "\u0645\u06d5\u062a\u0631: <b>"+fmt(tM)+"</b>";
  if (!conc.length) txt = "\u0647\u06cc\u0686 \u062f\u0627\u062a\u0627\u06cc\u06d5\u06a9 \u0646\u06cc\u06cc\u06d5";
  await sm(c, txt); rs(c);
}

async function handleCB(cb) {
  var c=cb.message.chat.id, d=cb.data, s=gs(c);
  fetch(API+"/answerCallbackQuery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({callback_query_id:cb.id})});

  if (d.startsWith("project_")) {
    s.project = d.replace("project_","");
    s.step = "password";
    await sm(c,"\u067e\u0631\u06c6\u0698\u06d5\u06cc <b>"+s.project+"</b> \u0647\u06d5\u06b5\u0628\u0698\u06ce\u0631\u062f\u0631\u0627 \u2705\n\n\u062a\u06a9\u0627\u06cc\u06d5 \u0648\u0634\u06d5\u06cc \u0646\u0647\u06ce\u0646\u06cc \u0628\u0646\u0648\u0648\u0633\u06d5:");
    return;
  }
  if (d==="report_cash") {
    var cashArr = await supa("cash?select=*&project=eq."+s.project);
    var cash = cashArr[0] || {cashiqd:0,cashusd:0};
    await sm(c,"\uD83D\uDCB0 <b>\u0642\u0627\u0633\u06d5</b>\n\n\u062f\u06cc\u0646\u0627\u0631: <b>"+fmt(cash.cashiqd)+"</b>\n\u062f\u06c6\u06b5\u0627\u0631: <b>$"+fmt(cash.cashusd)+"</b>");
    return;
  }
  if (d==="report_monthly") { s.step="m_currency"; await sm(c,"\u062f\u0631\u0627\u0648 \u0647\u06d5\u06b5\u0628\u0698\u06ce\u0631\u06d5:",kb([[{text:"\uD83C\uDDEE\uD83C\uDDF6 \u062f\u06cc\u0646\u0627\u0631",callback_data:"cur_iqd"},{text:"\uD83C\uDDFA\uD83C\uDDF8 \u062f\u06c6\u06b5\u0627\u0631",callback_data:"cur_usd"}]])); return; }
  if (d==="report_expenses") { s.step="exp_df"; await sm(c,"\u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u0633\u06d5\u0631\u06d5\u062a\u0627:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-01</code>"); return; }
  if (d==="report_concrete") { s.step="conc_df"; await sm(c,"\u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u0633\u06d5\u0631\u06d5\u062a\u0627:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-01</code>"); return; }
  if (d==="cur_iqd"||d==="cur_usd") { s.currency=d.replace("cur_",""); s.step="m_rate"; await sm(c,"\u0646\u0631\u062e\u06cc \u0626\u0627\u06b5\u0648\u06af\u06c6\u0695:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>1500</code>"); return; }
  if (d==="dep_yes"||d==="dep_no") { s.deposit=d.replace("dep_",""); s.step="m_df"; await sm(c,"\u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u0633\u06d5\u0631\u06d5\u062a\u0627:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-01</code>"); return; }
}

async function handleMsg(msg) {
  var c=msg.chat.id, t=(msg.text||"").trim();
  if (t==="/start") return handleStart(c);
  var s=gs(c);

  if (s.step==="password") {
    var user = await getProject(s.project);
    if (user && t === user.password) {
      s.step="menu";
      await sm(c,"\u0648\u0634\u06d5\u06cc \u0646\u0647\u06ce\u0646\u06cc \u0695\u0627\u0633\u062a\u06d5 \u2705\n\n\u0686\u06cc \u062f\u06d5\u062a\u06d5\u0648\u06ce\u062a\u061f",kb([
        [{text:"\uD83D\uDCB0 \u0642\u0627\u0633\u06d5",callback_data:"report_cash"}],
        [{text:"\uD83D\uDCCA \u06a9\u06d5\u0634\u0641 \u062d\u06cc\u0633\u0627\u0628",callback_data:"report_monthly"}],
        [{text:"\uD83D\uDCDD \u062e\u06d5\u0631\u062c\u06cc\u06d5\u06a9\u0627\u0646",callback_data:"report_expenses"}],
        [{text:"\uD83C\uDFD7 \u0633\u0644\u0641\u06d5 \u06a9\u06c6\u0646\u06a9\u0631\u06ce\u062a",callback_data:"report_concrete"}]
      ]));
    } else {
      await sm(c,"\u26A0\uFE0F \u0648\u0634\u06d5\u06cc \u0646\u0647\u06ce\u0646\u06cc \u0647\u06d5\u06b5\u06d5\u06cc\u06d5!");
    }
    return;
  }
  if (s.step==="m_rate") { s.rate=Number(t)||1500; s.step="m_dep"; await sm(c,"\u062a\u06d5\u0626\u0645\u06cc\u0646 \u0644\u06d5 \u0642\u0627\u0632\u0627\u0646\u062c\u062f\u0627 \u0647\u06d5\u0628\u06ce\u062a\u061f",kb([[{text:"\u2705 \u0628\u06d5\u06b5\u06ce",callback_data:"dep_yes"},{text:"\u274C \u0646\u06d5\u062e\u06ce\u0631",callback_data:"dep_no"}]])); return; }
  if (s.step==="m_df") { s.dateFrom=t; s.step="m_dt"; await sm(c,"\u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u06a9\u06c6\u062a\u0627\u06cc\u06cc:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-24</code>"); return; }
  if (s.step==="m_dt") { s.dateTo=t; await genReport(c,s); return; }
  if (s.step==="exp_df") { s.dateFrom=t; s.step="exp_dt"; await sm(c,"\u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u06a9\u06c6\u062a\u0627\u06cc\u06cc:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-24</code>"); return; }
  if (s.step==="exp_dt") { s.dateTo=t; await genExpList(c,s); return; }
  if (s.step==="conc_df") { s.dateFrom=t; s.step="conc_dt"; await sm(c,"\u0628\u06d5\u0631\u0648\u0627\u0631\u06cc \u06a9\u06c6\u062a\u0627\u06cc\u06cc:\n\u0628\u06c6 \u0646\u0645\u0648\u0648\u0646\u06d5: <code>2026-03-24</code>"); return; }
  if (s.step==="conc_dt") { s.dateTo=t; await genConcList(c,s); return; }

  await sm(c,"\u0628\u06c6 \u062f\u06d5\u0633\u062a\u067e\u06ce\u06a9\u0631\u062f\u0646 /start \u0628\u0646\u0648\u0648\u0633\u06d5");
}

app.post("/webhook/"+TOKEN,function(q,r){var u=q.body;if(u.callback_query)handleCB(u.callback_query);else if(u.message)handleMsg(u.message);r.sendStatus(200);});
app.get("/",function(q,r){r.send("Karo Bot v5");});
var PORT=process.env.PORT||3000;
app.listen(PORT,async function(){
  console.log("Server on port "+PORT);
  var U=process.env.RENDER_EXTERNAL_URL;
  if(U){var w=U+"/webhook/"+TOKEN;var r=await fetch(API+"/setWebhook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:w})});var d=await r.json();console.log("Webhook:",d);}
});
