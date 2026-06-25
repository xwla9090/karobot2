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

// ⭐ تابدیلی بەروار لە DD/MM/YYYY بۆ YYYY-MM-DD
function parseDate(d) {
  if (!d) return null;
  d = d.trim();
  // شێوازی DD/MM/YYYY
  var m1 = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return m1[3] + "-" + m1[2].padStart(2,"0") + "-" + m1[1].padStart(2,"0");
  // شێوازی DD-MM-YYYY
  var m2 = d.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return m2[3] + "-" + m2[2].padStart(2,"0") + "-" + m2[1].padStart(2,"0");
  // شێوازی YYYY-MM-DD (پێشوو باشە)
  var m3 = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m3) return m3[1] + "-" + m3[2].padStart(2,"0") + "-" + m3[3].padStart(2,"0");
  return null;
}

// ⭐ پشکنینی بەروار
function isValidDate(d) {
  return parseDate(d) !== null;
}

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
    row.push({text: "📁 " + (projects[i].label || projects[i].project), callback_data: "project_" + projects[i].project});
    if (row.length === 2 || i === projects.length - 1) { buttons.push(row); row = []; }
  }
  await sm(c, "سڵاو! بەخێر بێت بۆ <b>Karo Group Bot</b>\n\nتکایە پرۆژەیەک هەڵبژێرە:", kb(buttons));
}

async function genReport(c, s) {
  var p=s.project, df=parseDate(s.dateFrom), dt=parseDate(s.dateTo), cur=s.currency, rate=s.rate, withDep=s.deposit==="yes";
  if (!df || !dt) { await sm(c, "⚠️ بەروارەکان هەڵەن!"); rs(c); return; }
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

  var r = "✅ <b>کەشف حیساب</b>\n\n";
  r += "📁 پرۆژە: <b>"+p+"</b>\n";
  r += "📅 لە: <b>"+df+"</b> تا: <b>"+dt+"</b>\n";
  r += "💱 دراو: <b>"+(cur==="usd"?"USD":"IQD")+"</b> | نرخ: <b>"+fmt(rate)+"</b>\n";
  r += "🔒 تەئمین: <b>"+(withDep?"بەڵێ":"نەخێر")+"</b>\n\n";
  r += "━━━━━━━━━━━━━━━\n\n";
  r += "💰 <b>قاسە:</b>\n";
  r += "   دینار: <b>"+fmt(cash.cashiqd)+"</b>\n";
  r += "   دۆڵار: <b>$"+fmt(cash.cashusd)+"</b>\n\n";
  r += "📊 <b>خەرجی:</b> "+sym+"<b>"+fmt(tExp)+"</b>\n\n";
  r += "🏗 <b>سلفە وەرگیراو:</b> "+sym+"<b>"+fmt(tConcRec)+"</b>\n";
  r += "🔒 <b>تەئمین:</b> "+sym+"<b>"+fmt(tConcDep)+"</b>\n";
  r += "📏 <b>مەتر:</b> <b>"+fmt(tMeters)+"</b>\n\n";
  if (withDep) r += "📊 <b>سلفە+تەئمین:</b> "+sym+"<b>"+fmt(tConcTotal)+"</b>\n\n";
  r += "━━━━━━━━━━━━━━━\n";
  if (profit>=0) r += "✅ <b>قازانج: "+sym+fmt(profit)+"</b>";
  else r += "❌ <b>زەرەر: "+sym+fmt(Math.abs(profit))+"</b>";
  await sm(c, r); rs(c);
}

async function genExpList(c, s) {
  var df=parseDate(s.dateFrom), dt=parseDate(s.dateTo);
  if (!df || !dt) { await sm(c, "⚠️ بەروارەکان هەڵەن!"); rs(c); return; }
  var exp = await supa("expenses?select=*&project=eq."+s.project+"&date=gte."+df+"&date=lte."+dt);
  var tI=0, tU=0;
  var txt = "📝 <b>خەرجیەکان</b>\n";
  txt += "لە: "+df+" تا: "+dt+"\n\n";
  for (var i=0;i<exp.length;i++) {
    var eI = Number(exp[i].amountiqd) || 0;
    var eU = Number(exp[i].amountusd) || 0;
    tI += eI; tU += eU;
    txt += "🔹 "+(exp[i].date||"")+" | "+fmt(eI)+" IQD | $"+fmt(eU)+" | "+(exp[i].note||"")+"\n";
  }
  txt += "\n━━━━━━━━━━\n";
  txt += "کۆی دینار: <b>"+fmt(tI)+"</b>\n";
  txt += "کۆی دۆڵار: <b>$"+fmt(tU)+"</b>";
  if (!exp.length) txt = "هیچ خەرجییەک نییە";
  await sm(c, txt); rs(c);
}

async function genConcList(c, s) {
  var df=parseDate(s.dateFrom), dt=parseDate(s.dateTo);
  if (!df || !dt) { await sm(c, "⚠️ بەروارەکان هەڵەن!"); rs(c); return; }
  var conc = await supa("concrete?select=*&project=eq."+s.project+"&date=gte."+df+"&date=lte."+dt);
  var tR=0, tD=0, tM=0;
  var txt = "🏗 <b>سلفە کۆنکریت</b>\n";
  txt += "لە: "+df+" تا: "+dt+"\n\n";
  for (var i=0;i<conc.length;i++) {
    var rec = Number(conc[i].received) || 0;
    var dep = Number(conc[i].deposit) || 0;
    var met = Number(conc[i].meters) || 0;
    tR += rec; tD += dep; tM += met;
    txt += "🔹 "+(conc[i].date||"")+" | "+fmt(met)+"m | "+fmt(rec)+" | تەئمین:"+fmt(dep)+" | "+(conc[i].note||"")+"\n";
  }
  txt += "\n━━━━━━━━━━\n";
  txt += "وەرگیراو: <b>"+fmt(tR)+"</b>\n";
  txt += "تەئمین: <b>"+fmt(tD)+"</b>\n";
  txt += "مەتر: <b>"+fmt(tM)+"</b>";
  if (!conc.length) txt = "هیچ داتایەک نییە";
  await sm(c, txt); rs(c);
}

async function handleCB(cb) {
  var c=cb.message.chat.id, d=cb.data, s=gs(c);
  fetch(API+"/answerCallbackQuery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({callback_query_id:cb.id})});

  if (d.startsWith("project_")) {
    s.project = d.replace("project_","");
    s.step = "password";
    await sm(c,"پرۆژەی <b>"+s.project+"</b> هەڵبژێردرا ✅\n\nتکایە وشەی نهێنی بنووسە:");
    return;
  }
  if (d==="report_cash") {
    var cashArr = await supa("cash?select=*&project=eq."+s.project);
    var cash = cashArr[0] || {cashiqd:0,cashusd:0};
    await sm(c,"💰 <b>قاسە</b>\n\nدینار: <b>"+fmt(cash.cashiqd)+"</b>\nدۆڵار: <b>$"+fmt(cash.cashusd)+"</b>");
    return;
  }
  if (d==="report_monthly") { s.step="m_currency"; await sm(c,"دراو هەڵبژێرە:",kb([[{text:"🇮🇶 دینار",callback_data:"cur_iqd"},{text:"🇺🇸 دۆڵار",callback_data:"cur_usd"}]])); return; }
  if (d==="report_expenses") { s.step="exp_df"; await sm(c,"بەرواری سەرەتا:\nبۆ نموونە: <code>01/06/2026</code> یان <code>2026-06-01</code>"); return; }
  if (d==="report_concrete") { s.step="conc_df"; await sm(c,"بەرواری سەرەتا:\nبۆ نموونە: <code>01/06/2026</code> یان <code>2026-06-01</code>"); return; }
  if (d==="cur_iqd"||d==="cur_usd") { s.currency=d.replace("cur_",""); s.step="m_rate"; await sm(c,"نرخی ئاڵوگۆڕ:\nبۆ نموونە: <code>1500</code>"); return; }
  if (d==="dep_yes"||d==="dep_no") { s.deposit=d.replace("dep_",""); s.step="m_df"; await sm(c,"بەرواری سەرەتا:\nبۆ نموونە: <code>01/06/2026</code> یان <code>2026-06-01</code>"); return; }
}

async function handleMsg(msg) {
  var c=msg.chat.id, t=(msg.text||"").trim();
  if (t==="/start") return handleStart(c);
  var s=gs(c);

  if (s.step==="password") {
    var user = await getProject(s.project);
    if (user && t === user.password) {
      s.step="menu";
      await sm(c,"وشەی نهێنی ڕاستە ✅\n\nچی دەتەوێت؟",kb([
        [{text:"💰 قاسە",callback_data:"report_cash"}],
        [{text:"📊 کەشف حیساب",callback_data:"report_monthly"}],
        [{text:"📝 خەرجیەکان",callback_data:"report_expenses"}],
        [{text:"🏗 سلفە کۆنکریت",callback_data:"report_concrete"}]
      ]));
    } else {
      await sm(c,"⚠️ وشەی نهێنی هەڵەیە!");
    }
    return;
  }
  if (s.step==="m_rate") { 
    s.rate=Number(t)||1500; 
    s.step="m_dep"; 
    await sm(c,"تەئمین لە قازانجدا هەبێت؟",kb([[{text:"✅ بەڵێ",callback_data:"dep_yes"},{text:"❌ نەخێر",callback_data:"dep_no"}]])); 
    return; 
  }
  if (s.step==="m_df") { 
    if (!isValidDate(t)) { await sm(c,"⚠️ بەروار هەڵەیە!\nبۆ نموونە: <code>01/06/2026</code> یان <code>2026-06-01</code>"); return; }
    s.dateFrom=t; s.step="m_dt"; 
    await sm(c,"بەرواری کۆتایی:\nبۆ نموونە: <code>30/06/2026</code> یان <code>2026-06-30</code>"); 
    return; 
  }
  if (s.step==="m_dt") { 
    if (!isValidDate(t)) { await sm(c,"⚠️ بەروار هەڵەیە!\nبۆ نموونە: <code>30/06/2026</code> یان <code>2026-06-30</code>"); return; }
    s.dateTo=t; await genReport(c,s); return; 
  }
  if (s.step==="exp_df") { 
    if (!isValidDate(t)) { await sm(c,"⚠️ بەروار هەڵەیە!\nبۆ نموونە: <code>01/06/2026</code> یان <code>2026-06-01</code>"); return; }
    s.dateFrom=t; s.step="exp_dt"; 
    await sm(c,"بەرواری کۆتایی:\nبۆ نموونە: <code>30/06/2026</code> یان <code>2026-06-30</code>"); 
    return; 
  }
  if (s.step==="exp_dt") { 
    if (!isValidDate(t)) { await sm(c,"⚠️ بەروار هەڵەیە!\nبۆ نموونە: <code>30/06/2026</code> یان <code>2026-06-30</code>"); return; }
    s.dateTo=t; await genExpList(c,s); return; 
  }
  if (s.step==="conc_df") { 
    if (!isValidDate(t)) { await sm(c,"⚠️ بەروار هەڵەیە!\nبۆ نموونە: <code>01/06/2026</code> یان <code>2026-06-01</code>"); return; }
    s.dateFrom=t; s.step="conc_dt"; 
    await sm(c,"بەرواری کۆتایی:\nبۆ نموونە: <code>30/06/2026</code> یان <code>2026-06-30</code>"); 
    return; 
  }
  if (s.step==="conc_dt") { 
    if (!isValidDate(t)) { await sm(c,"⚠️ بەروار هەڵەیە!\nبۆ نموونە: <code>30/06/2026</code> یان <code>2026-06-30</code>"); return; }
    s.dateTo=t; await genConcList(c,s); return; 
  }

  await sm(c,"بۆ دەستپێکردن /start بنووسە");
}

app.post("/webhook/"+TOKEN,function(q,r){var u=q.body;if(u.callback_query)handleCB(u.callback_query);else if(u.message)handleMsg(u.message);r.sendStatus(200);});
app.get("/",function(q,r){r.send("Karo Bot v6");});
var PORT=process.env.PORT||3000;
app.listen(PORT,async function(){
  console.log("Server on port "+PORT);
  var U=process.env.RENDER_EXTERNAL_URL;
  if(U){var w=U+"/webhook/"+TOKEN;var r=await fetch(API+"/setWebhook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:w})});var d=await r.json();console.log("Webhook:",d);}
});
