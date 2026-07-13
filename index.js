const express = require("express");
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));
const FormData = require("form-data");
const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const API = "https://api.telegram.org/bot" + TOKEN;
const SUPA_URL = "https://scwgsaglnpyvkblegewd.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd2dzYWdsbnB5dmtibGVnZXdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzc4NzksImV4cCI6MjA4OTkxMzg3OX0._vqhk6WVe8J8mZhJE1G63y8Js8-_X5A5h_RvgJ0SC80";
const BACKUP_CHAT_ID = "176392487";

var sessions = {};
var lastBackupTime = {};

// ==================== SESSION ====================
function gs(c) {
  if (!sessions[c]) sessions[c] = {step:"start",project:null,password:null,currency:null,rate:1500,deposit:"no",dateFrom:null,dateTo:null};
  return sessions[c];
}
// ریست session بۆ menu نەک start — چارەسەری کێشەی ٣
function resetToMenu(s) {
  s.step = "menu";
  s.currency = null;
  s.rate = 1500;
  s.deposit = "no";
  s.dateFrom = null;
  s.dateTo = null;
}

async function sm(c, t, o) {
  var b = {chat_id:c, text:t, parse_mode:"HTML"};
  if (o) b.reply_markup = o.reply_markup;
  await fetch(API+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});
}
function kb(b) { return {reply_markup:{inline_keyboard:b}}; }
function fmt(n) { return Math.round(Number(n) || 0).toLocaleString(); }

// ==================== بەروار ====================
function parseDate(d) {
  if (!d) return null;
  d = d.trim();
  // DD/MM/YYYY
  var m1 = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return m1[3] + "-" + m1[2].padStart(2,"0") + "-" + m1[1].padStart(2,"0");
  // DD-MM-YYYY
  var m2 = d.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return m2[3] + "-" + m2[2].padStart(2,"0") + "-" + m2[1].padStart(2,"0");
  // YYYY-MM-DD
  var m3 = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m3) return m3[1] + "-" + m3[2].padStart(2,"0") + "-" + m3[3].padStart(2,"0");
  // YYYY/MM/DD
  var m4 = d.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m4) return m4[1] + "-" + m4[2].padStart(2,"0") + "-" + m4[3].padStart(2,"0");
  // MM/DD/YYYY (ئەمریکی)
  var m5 = d.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m5) return m5[3] + "-" + m5[2].padStart(2,"0") + "-" + m5[1].padStart(2,"0");
  return null;
}
function isValidDate(d) { return parseDate(d) !== null; }

// ==================== SUPABASE ====================
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

// ==================== XLSX ====================
function makeXLSX(sheets) {
  var sharedStrings = [];
  var sharedMap = {};
  function addStr(s) {
    s = String(s || "");
    if (sharedMap[s] === undefined) { sharedMap[s] = sharedStrings.length; sharedStrings.push(s); }
    return sharedMap[s];
  }
  sheets.forEach(function(sh) {
    sh.headers.forEach(addStr);
    sh.rows.forEach(function(r) { r.forEach(function(c) { addStr(c); }); });
  });
  var sheetsXML = sheets.map(function(sh) {
    var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    xml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
    xml += '<row r="1">';
    sh.headers.forEach(function(h, ci) {
      var col = String.fromCharCode(65 + ci);
      xml += '<c r="'+col+'1" t="s"><v>'+addStr(h)+'</v></c>';
    });
    xml += '</row>';
    sh.rows.forEach(function(row, ri) {
      xml += '<row r="'+(ri+2)+'">';
      row.forEach(function(cell, ci) {
        var col = String.fromCharCode(65 + ci);
        var v = String(cell || "");
        var num = Number(v);
        if (!isNaN(num) && v !== "" && !v.match(/^\d{4}-\d{2}-\d{2}/)) {
          xml += '<c r="'+col+(ri+2)+'"><v>'+num+'</v></c>';
        } else {
          xml += '<c r="'+col+(ri+2)+'" t="s"><v>'+addStr(v)+'</v></c>';
        }
      });
      xml += '</row>';
    });
    xml += '</sheetData></worksheet>';
    return xml;
  });
  var ssXML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'+sharedStrings.length+'" uniqueCount="'+sharedStrings.length+'">';
  sharedStrings.forEach(function(s) { ssXML += '<si><t xml:space="preserve">'+s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+'</t></si>'; });
  ssXML += '</sst>';
  var wbXML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
  sheets.forEach(function(sh, si) { wbXML += '<sheet name="'+sh.name.replace(/&/g,"&amp;")+'" sheetId="'+(si+1)+'" r:id="rId'+(si+1)+'"/>'; });
  wbXML += '</sheets></workbook>';
  var wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  sheets.forEach(function(sh, si) { wbRels += '<Relationship Id="rId'+(si+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(si+1)+'.xml"/>'; });
  wbRels += '<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>';
  var ctXML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>';
  sheets.forEach(function(sh, si) { ctXML += '<Override PartName="/xl/worksheets/sheet'+(si+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; });
  ctXML += '</Types>';
  var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  var JSZip = require("jszip");
  var zip = new JSZip();
  zip.file("[Content_Types].xml", ctXML);
  zip.file("_rels/.rels", rootRels);
  zip.file("xl/workbook.xml", wbXML);
  zip.file("xl/_rels/workbook.xml.rels", wbRels);
  zip.file("xl/sharedStrings.xml", ssXML);
  sheets.forEach(function(sh, si) { zip.file("xl/worksheets/sheet"+(si+1)+".xml", sheetsXML[si]); });
  return zip.generateAsync({type:"nodebuffer", compression:"DEFLATE"});
}

async function sendXLSX(chatId, buffer, filename, caption) {
  var form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("document", buffer, { filename: filename, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  form.append("caption", caption);
  var resp = await fetch(API+"/sendDocument", { method:"POST", body: form });
  var data = await resp.json();
  if (!data.ok) console.error("[Backup] sendDocument error:", data);
  return data;
}

// ==================== BACKUP ====================
async function doBackup(project, chatId, manual) {
  try {
    var today = new Date().toISOString().slice(0,10);
    var cashArr = await supa("cash?select=*&project=eq."+project);
    var cash = cashArr[0] || {cashiqd:0, cashusd:0};
    var exp = await supa("expenses?select=*&project=eq."+project+"&order=date.desc");
    var conc = await supa("concrete?select=*&project=eq."+project+"&order=date.desc");
    var loans = await supa("loans?select=*&project=eq."+project+"&order=date.desc");
    var contr = await supa("contractor?select=*&project=eq."+project+"&order=date.desc");

    var msg = (manual ? "📦 <b>Backup دەستی</b>" : "🔄 <b>Backup خۆکار (هەر ١٠ ڕۆژ)</b>") + "\n\n";
    msg += "📁 پرۆژە: <b>"+project+"</b>\n📅 بەروار: <b>"+today+"</b>\n\n";
    msg += "💰 قاسە:\n   دینار: <b>"+fmt(cash.cashiqd)+"</b>\n   دۆڵار: <b>$"+fmt(cash.cashusd)+"</b>\n\n";
    msg += "📊 خەرجی: <b>"+exp.length+"</b> تۆمار\n🏗 سلفە: <b>"+conc.length+"</b> تۆمار\n💳 قەرز: <b>"+loans.length+"</b> تۆمار\n👷 مقاول: <b>"+contr.length+"</b> تۆمار\n\n⏳ فایلی Excel ئامادە دەکرێت...";
    await fetch(API+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chatId,text:msg,parse_mode:"HTML"})});

    var sheets = [
      // کێشەی ١ چارەسەر: order=date.desc بۆ ریزبەندی نوێترین سەرەوە
      {
        name: "خەرجی",
        headers: ["بەروار","بڕی دینار","بڕی دۆلار","ژمارەی وەسڵ","تێبینی"],
        rows: exp.map(function(e){return[e.date||"",e.amountiqd||0,e.amountusd||0,e.receiptno||"",e.note||""];})
      },
      {
        name: "سلفەی کۆنکریت",
        headers: ["بەروار","دراو","مەتر","نرخی مەتر","کۆی گشتی","تەئمین","وەرگیراو","تێبینی"],
        rows: conc.map(function(c){return[c.date||"",c.currency||"",c.meters||0,c.pricepermeter||0,c.totalprice||0,c.deposit||0,c.received||0,c.note||""];})
      },
      {
        name: "قەرز",
        headers: ["بەروار","جۆر","ناوی کەس","بڕی دینار","بڕی دۆلار","گەڕێنداوەتەوە","تێبینی"],
        rows: loans.map(function(l){return[l.date||"",l.type||"",l.personname||"",l.amountiqd||0,l.amountusd||0,l.returned?"بەڵێ":"نەخێر",l.note||""];})
      },
      {
        name: "مقاول",
        headers: ["بەروار","جۆر","ناوی کەس","بڕی دینار","بڕی دۆلار","تێبینی"],
        rows: contr.map(function(c){return[c.date||"",c.type||"",c.personname||"",c.amountiqd||0,c.amountusd||0,c.note||""];})
      },
      {
        name: "خولاصە",
        headers: ["بەش","زانیاری","نرخ"],
        rows: [
          ["قاسە","دینار",fmt(cash.cashiqd)],
          ["قاسە","دۆلار","$"+fmt(cash.cashusd)],
          ["خەرجی","ژماری تۆمار",exp.length],
          ["سلفە","ژماری تۆمار",conc.length],
          ["قەرز","ژماری تۆمار",loans.length],
          ["مقاول","ژماری تۆمار",contr.length],
          ["بەروار","Backup",today]
        ]
      }
    ];

    var xlsxBuffer = await makeXLSX(sheets);
    await sendXLSX(chatId, xlsxBuffer, "backup_"+project+"_"+today+".xlsx", "📊 Backup — "+project+" — "+today);

    lastBackupTime[project] = Date.now();
    var nextBackup = new Date(Date.now() + 10*24*60*60*1000).toISOString().slice(0,10);
    await fetch(API+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chatId,text:"✅ <b>Backup تەواو بوو!</b>\n\n📁 <b>"+project+"</b>\n📅 Backup داهاتوو: <b>"+nextBackup+"</b>",parse_mode:"HTML"})});
    console.log("[Backup] ✅ Done:", project);
  } catch(e) {
    console.error("[Backup] Error:", e);
    await fetch(API+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chatId,text:"❌ هەڵە: "+e.message,parse_mode:"HTML"})});
  }
}

async function checkAndRunBackups() {
  try {
    var projects = await getProjects();
    var TEN_DAYS = 10 * 24 * 60 * 60 * 1000;
    for (var i = 0; i < projects.length; i++) {
      var p = projects[i].project;
      var last = lastBackupTime[p] || 0;
      if (Date.now() - last >= TEN_DAYS) {
        await doBackup(p, BACKUP_CHAT_ID, false);
        await new Promise(function(r){setTimeout(r,10000);});
      }
    }
  } catch(e) { console.error("[Backup] checkAndRunBackups error:", e); }
}

setInterval(checkAndRunBackups, 6 * 60 * 60 * 1000);
setTimeout(checkAndRunBackups, 60 * 1000);

// ==================== MENU ====================
var MENU_KB = kb([
  [{text:"💰 قاسە",callback_data:"report_cash"}],
  [{text:"📊 کەشف حیساب",callback_data:"report_monthly"}],
  [{text:"📝 خەرجیەکان",callback_data:"report_expenses"}],
  [{text:"🏗 سلفە کۆنکریت",callback_data:"report_concrete"}],
  [{text:"📦 Backup دەستی",callback_data:"report_backup"}]
]);

async function handleStart(c) {
  sessions[c] = {step:"start",project:null,password:null,currency:null,rate:1500,deposit:"no",dateFrom:null,dateTo:null};
  var projects = await getProjects();
  var buttons = [], row = [];
  for (var i = 0; i < projects.length; i++) {
    row.push({text:"📁 "+(projects[i].label||projects[i].project), callback_data:"project_"+projects[i].project});
    if (row.length===2||i===projects.length-1){buttons.push(row);row=[];}
  }
  await sm(c,"سڵاو! بەخێر بێت بۆ <b>Karo Group Bot</b>\n\nتکایە پرۆژەیەک هەڵبژێرە:",kb(buttons));
}

// ==================== کێشەی ٢ چارەسەر: ریزبەندی لە Supabase ====================
async function genReport(c, s) {
  var p=s.project, df=parseDate(s.dateFrom), dt=parseDate(s.dateTo), cur=s.currency, rate=s.rate, withDep=s.deposit==="yes";
  if(!df||!dt){await sm(c,"⚠️ بەروارەکان هەڵەن!");resetToMenu(s);await sm(c,"چی دەتەوێت؟",MENU_KB);return;}

  // پشکنین بەرواری سەرەتا لە کۆتایی کەمتر بێت
  if(df > dt){await sm(c,"⚠️ بەرواری سەرەتا پێویستە لە کۆتایی کەمتر بێت!\nبۆ نموونە: سەرەتا 01/05/2025 — کۆتایی 01/06/2025");resetToMenu(s);await sm(c,"چی دەتەوێت؟",MENU_KB);return;}

  var cashArr=await supa("cash?select=*&project=eq."+p);
  var cash=cashArr[0]||{cashiqd:0,cashusd:0};
  var exp=await supa("expenses?select=*&project=eq."+p+"&date=gte."+df+"&date=lte."+dt);
  var conc=await supa("concrete?select=*&project=eq."+p+"&date=gte."+df+"&date=lte."+dt);
  var sym=cur==="usd"?"$":"";
  var tExp=0;
  for(var i=0;i<exp.length;i++){var eI=Number(exp[i].amountiqd)||0,eU=Number(exp[i].amountusd)||0;if(cur==="iqd")tExp+=eI+eU*rate;else tExp+=eU+eI/rate;}
  tExp=Math.round(tExp);
  var tConcRec=0,tConcDep=0,tMeters=0;
  for(var i=0;i<conc.length;i++){var cc=conc[i].currency||"iqd",rec=Number(conc[i].received)||0,dep=Number(conc[i].deposit)||0,met=Number(conc[i].meters)||0;if(cur==="iqd"){tConcRec+=cc==="iqd"?rec:rec*rate;tConcDep+=cc==="iqd"?dep:dep*rate;}else{tConcRec+=cc==="usd"?rec:rec/rate;tConcDep+=cc==="usd"?dep:dep/rate;}tMeters+=met;}
  tConcRec=Math.round(tConcRec);tConcDep=Math.round(tConcDep);
  var tConcTotal=withDep?tConcRec+tConcDep:tConcRec,profit=tConcTotal-tExp;
  var r="✅ <b>کەشف حیساب</b>\n\n📁 پرۆژە: <b>"+p+"</b>\n📅 لە: <b>"+df+"</b> تا: <b>"+dt+"</b>\n💱 دراو: <b>"+(cur==="usd"?"USD":"IQD")+"</b> | نرخ: <b>"+fmt(rate)+"</b>\n🔒 تەئمین: <b>"+(withDep?"بەڵێ":"نەخێر")+"</b>\n\n━━━━━━━━━━━━━━━\n\n";
  r+="💰 <b>قاسە:</b>\n   دینار: <b>"+fmt(cash.cashiqd)+"</b>\n   دۆڵار: <b>$"+fmt(cash.cashusd)+"</b>\n\n";
  r+="📊 <b>خەرجی:</b> "+sym+"<b>"+fmt(tExp)+"</b>\n\n";
  r+="🏗 <b>سلفە وەرگیراو:</b> "+sym+"<b>"+fmt(tConcRec)+"</b>\n";
  r+="🔒 <b>تەئمین:</b> "+sym+"<b>"+fmt(tConcDep)+"</b>\n";
  r+="📏 <b>مەتر:</b> <b>"+fmt(tMeters)+"</b>\n\n";
  if(withDep)r+="📊 <b>سلفە+تەئمین:</b> "+sym+"<b>"+fmt(tConcTotal)+"</b>\n\n";
  r+="━━━━━━━━━━━━━━━\n"+(profit>=0?"✅ <b>قازانج: "+sym+fmt(profit)+"</b>":"❌ <b>زەرەر: "+sym+fmt(Math.abs(profit))+"</b>");
  await sm(c,r);
  resetToMenu(s);
  await sm(c,"چی دەتەوێت؟",MENU_KB);
}

async function genExpList(c, s) {
  var df=parseDate(s.dateFrom),dt=parseDate(s.dateTo);
  if(!df||!dt){await sm(c,"⚠️ بەروارەکان هەڵەن!");resetToMenu(s);await sm(c,"چی دەتەوێت؟",MENU_KB);return;}
  if(df > dt){await sm(c,"⚠️ بەرواری سەرەتا پێویستە لە کۆتایی کەمتر بێت!");resetToMenu(s);await sm(c,"چی دەتەوێت؟",MENU_KB);return;}

  // ریزبەندی بەروار نوێترین سەرەوە
  var exp=await supa("expenses?select=*&project=eq."+s.project+"&date=gte."+df+"&date=lte."+dt+"&order=date.desc");
  var tI=0,tU=0;
  var lines = [];
  for(var i=0;i<exp.length;i++){
    var eI=Number(exp[i].amountiqd)||0,eU=Number(exp[i].amountusd)||0;
    tI+=eI;tU+=eU;
    lines.push("🔹 "+(exp[i].date||"")+" | "+fmt(eI)+" IQD | $"+fmt(eU)+" | "+(exp[i].note||""));
  }
  if(!exp.length){
    await sm(c,"هیچ خەرجییەک نییە لەو ماوەیەدا\n📅 لە: "+df+" تا: "+dt);
  } else {
    // پارچە پارچە بنێرە ئەگەر زۆر بوو
    var header = "📝 <b>خەرجیەکان</b>\nلە: "+df+" تا: "+dt+"\n\n";
    var footer = "\n━━━━━━━━━━\nکۆی دینار: <b>"+fmt(tI)+"</b>\nکۆی دۆڵار: <b>$"+fmt(tU)+"</b>\nژماری تۆمار: <b>"+exp.length+"</b>";
    var chunk = header;
    for(var li=0;li<lines.length;li++){
      if((chunk+lines[li]).length > 3800){
        await sm(c,chunk);
        chunk = "";
      }
      chunk += lines[li]+"\n";
    }
    chunk += footer;
    await sm(c,chunk);
  }
  resetToMenu(s);
  await sm(c,"چی دەتەوێت؟",MENU_KB);
}

async function genConcList(c, s) {
  var df=parseDate(s.dateFrom),dt=parseDate(s.dateTo);
  if(!df||!dt){await sm(c,"⚠️ بەروارەکان هەڵەن!");resetToMenu(s);await sm(c,"چی دەتەوێت؟",MENU_KB);return;}
  if(df > dt){await sm(c,"⚠️ بەرواری سەرەتا پێویستە لە کۆتایی کەمتر بێت!");resetToMenu(s);await sm(c,"چی دەتەوێت؟",MENU_KB);return;}

  // ریزبەندی بەروار نوێترین سەرەوە
  var conc=await supa("concrete?select=*&project=eq."+s.project+"&date=gte."+df+"&date=lte."+dt+"&order=date.desc");
  var tR=0,tD=0,tM=0;
  var txt="🏗 <b>سلفە کۆنکریت</b>\nلە: "+df+" تا: "+dt+"\n\n";
  for(var i=0;i<conc.length;i++){
    var rec=Number(conc[i].received)||0,dep=Number(conc[i].deposit)||0,met=Number(conc[i].meters)||0;
    tR+=rec;tD+=dep;tM+=met;
    txt+="🔹 "+(conc[i].date||"")+" | "+fmt(met)+"m | "+fmt(rec)+" | تەئمین:"+fmt(dep)+" | "+(conc[i].note||"")+"\n";
  }
  txt+="\n━━━━━━━━━━\nوەرگیراو: <b>"+fmt(tR)+"</b>\nتەئمین: <b>"+fmt(tD)+"</b>\nمەتر: <b>"+fmt(tM)+"</b>";
  if(!conc.length)txt="هیچ داتایەک نییە لەو ماوەیەدا\n📅 لە: "+df+" تا: "+dt;
  await sm(c,txt);
  resetToMenu(s);
  await sm(c,"چی دەتەوێت؟",MENU_KB);
}

// ==================== CALLBACKS ====================
async function handleCB(cb) {
  var c=cb.message.chat.id,d=cb.data,s=gs(c);
  fetch(API+"/answerCallbackQuery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({callback_query_id:cb.id})});

  if(d.startsWith("project_")){s.project=d.replace("project_","");s.step="password";await sm(c,"پرۆژەی <b>"+s.project+"</b> هەڵبژێردرا ✅\n\nتکایە وشەی نهێنی بنووسە:");return;}
  if(d==="report_cash"){
    var cashArr=await supa("cash?select=*&project=eq."+s.project);
    var cash=cashArr[0]||{cashiqd:0,cashusd:0};
    await sm(c,"💰 <b>قاسە</b>\n\nدینار: <b>"+fmt(cash.cashiqd)+"</b>\nدۆڵار: <b>$"+fmt(cash.cashusd)+"</b>");
    await sm(c,"چی دەتەوێت؟",MENU_KB);return;
  }
  if(d==="report_backup"){await sm(c,"📦 Backup دەستی دەستی پێکرد...");await doBackup(s.project,c,true);await sm(c,"چی دەتەوێت؟",MENU_KB);return;}
  if(d==="report_monthly"){s.step="m_currency";await sm(c,"دراو هەڵبژێرە:",kb([[{text:"🇮🇶 دینار",callback_data:"cur_iqd"},{text:"🇺🇸 دۆڵار",callback_data:"cur_usd"}]]));return;}
  if(d==="report_expenses"){s.step="exp_df";await sm(c,"بەرواری سەرەتا:\nبۆ نموونە: <code>01/05/2025</code>");return;}
  if(d==="report_concrete"){s.step="conc_df";await sm(c,"بەرواری سەرەتا:\nبۆ نموونە: <code>01/05/2025</code>");return;}
  if(d==="cur_iqd"||d==="cur_usd"){s.currency=d.replace("cur_","");s.step="m_rate";await sm(c,"نرخی ئاڵوگۆڕ:\nبۆ نموونە: <code>1500</code>");return;}
  if(d==="dep_yes"||d==="dep_no"){s.deposit=d.replace("dep_","");s.step="m_df";await sm(c,"بەرواری سەرەتا:\nبۆ نموونە: <code>01/05/2025</code>");return;}
}

// ==================== MESSAGES ====================
async function handleMsg(msg) {
  var c=msg.chat.id,t=(msg.text||"").trim();
  if(t==="/start")return handleStart(c);
  if(t==="/backup"){
    var s=gs(c);
    if(!s.project){await sm(c,"تکایە یەکەم /start بنووسە");return;}
    await sm(c,"📦 Backup دەستی...");
    await doBackup(s.project,c,true);
    await sm(c,"چی دەتەوێت؟",MENU_KB);
    return;
  }
  var s=gs(c);

  // ئەگەر step="start" و پرۆژە نییە — دووبارە /start
  if(s.step==="start"||!s.project&&s.step!=="start"){
    await handleStart(c);return;
  }

  if(s.step==="password"){
    var user=await getProject(s.project);
    if(user&&t===user.password){s.step="menu";await sm(c,"وشەی نهێنی ڕاستە ✅\n\nچی دەتەوێت؟",MENU_KB);}
    else{await sm(c,"⚠️ وشەی نهێنی هەڵەیە!");}
    return;
  }
  if(s.step==="m_rate"){s.rate=Number(t)||1500;s.step="m_dep";await sm(c,"تەئمین لە قازانجدا هەبێت؟",kb([[{text:"✅ بەڵێ",callback_data:"dep_yes"},{text:"❌ نەخێر",callback_data:"dep_no"}]]));return;}
  if(s.step==="m_df"){if(!isValidDate(t)){await sm(c,"⚠️ بەروار هەڵەیە!\nبۆ نموونە: <code>01/05/2025</code>");return;}s.dateFrom=t;s.step="m_dt";await sm(c,"بەرواری کۆتایی:\nبۆ نموونە: <code>31/05/2025</code>");return;}
  if(s.step==="m_dt"){if(!isValidDate(t)){await sm(c,"⚠️ بەروار هەڵەیە!");return;}s.dateTo=t;await genReport(c,s);return;}
  if(s.step==="exp_df"){if(!isValidDate(t)){await sm(c,"⚠️ بەروار هەڵەیە!\nبۆ نموونە: <code>01/05/2025</code>");return;}s.dateFrom=t;s.step="exp_dt";await sm(c,"بەرواری کۆتایی:\nبۆ نموونە: <code>31/05/2025</code>");return;}
  if(s.step==="exp_dt"){if(!isValidDate(t)){await sm(c,"⚠️ بەروار هەڵەیە!");return;}s.dateTo=t;await genExpList(c,s);return;}
  if(s.step==="conc_df"){if(!isValidDate(t)){await sm(c,"⚠️ بەروار هەڵەیە!\nبۆ نموونە: <code>01/05/2025</code>");return;}s.dateFrom=t;s.step="conc_dt";await sm(c,"بەرواری کۆتایی:\nبۆ نموونە: <code>31/05/2025</code>");return;}
  if(s.step==="conc_dt"){if(!isValidDate(t)){await sm(c,"⚠️ بەروار هەڵەیە!");return;}s.dateTo=t;await genConcList(c,s);return;}

  // ئەگەر step="menu" بوو و تێکست نووسی — مینیوو نیشان بدە
  if(s.step==="menu"){await sm(c,"چی دەتەوێت؟",MENU_KB);return;}

  await sm(c,"بۆ دەستپێکردن /start بنووسە");
}

app.post("/webhook/"+TOKEN,function(q,r){var u=q.body;if(u.callback_query)handleCB(u.callback_query);else if(u.message)handleMsg(u.message);r.sendStatus(200);});
app.get("/",function(q,r){r.send("Karo Bot v9");});
var PORT=process.env.PORT||3000;
app.listen(PORT,async function(){
  console.log("Karo Bot v9 on port "+PORT);
  var U=process.env.RENDER_EXTERNAL_URL;
  if(U){var w=U+"/webhook/"+TOKEN;var res=await fetch(API+"/setWebhook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:w})});var d=await res.json();console.log("Webhook:",d);}
});
