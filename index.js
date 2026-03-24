step === "rate") {
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