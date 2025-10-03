const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");

const supabase = createClient("https://rdacdjpcbcgkxsqwofnz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkYWNkanBjYmNna3hzcXdvZm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0NDg3MzcsImV4cCI6MjA2MjAyNDczN30.IAvUW-LWkj78QcO-ts_JJp72TN0Uy_kJMc_3CreC8iY");

function randomSessionID() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function createNewSession(role, model = "qwen") {
  const sessionId = randomSessionID();
  const messages = [
    {
      role: "system",
      content: role || "Kamu adalah AI ramah, Pintar, dan Sopan yang siap membantu. Nama Kamu FalcoAI. Kamu suka menjawab pertanyaan dengan santai dan informatif."
    }
  ];
  await supabase.from("ai_sessions").insert({
    user_id: sessionId,
    model,
    messages,
    updated_at: new Date()
  });
  return sessionId;
}

async function deleteExpiredSessions() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  await supabase.from("ai_sessions").delete().lt("updated_at", oneHourAgo);
}

async function qwenai(prompt, messages) {
  const { data } = await axios.post("https://chat.qwen.ai/api/chat/completions", {
    stream: false,
    chat_type: "t2t",
    model: "qwen-turbo-2025-02-11",
    messages,
    session_id: uuidv4(),
    chat_id: uuidv4(),
    id: uuidv4()
  }, {
    headers: {
                accept: '*/*',
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'en-US,en;q=0.9',
                authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NTI0YWVhLTNjMjEtNDgwMi05YWY0LTdjZThkNmEwZTE3MSIsImV4cCI6MTc1MDA5MTA2OX0.sDC1jJ4WPlyGzgVi6x6m4vQ31miAOxa1MedflPNKG38',
                'bx-v': '2.5.28',
                'content-type': 'application/json',
                cookie: '_gcl_aw=GCL.1744865954.EAIaIQobChMI04zMmaTejAMVibpLBR0vgx8VEAAYASAAEgK8aPD_BwE; _gcl_gs=2.1.k1$i1744865952$u64539133; _gcl_au=1.1.1153047962.1744865954; _bl_uid=7jmmh9e2ksXwg25g02g8jXsjmn64; acw_tc=0a03e55a17474990039571388e56a2dd601a641b88c7c4cf572eed257291c4; x-ap=ap-southeast-5; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NTI0YWVhLTNjMjEtNDgwMi05YWY0LTdjZThkNmEwZTE3MSIsImV4cCI6MTc1MDA5MTA3OH0.W87CVNXvRVE2ZZ2SaAGAThhRC0Ro_4vnENwoXxfC698; ssxmod_itna=Yqfx0D9DBAeeT4eIqmq4iu0xYTxewDAQDXDUdnq7U=GcD8OD0PO+6r5GkUnEAQ05Gq0Q45omR=DlgG0AiDCuPGfDQcYHOQQbhi5YzB7Oi3tK122GmqTst=+x3b8izRu4adC0=6D74i8Nxi1DG5DGexDRxikD7v4pE0YDeeDtx0rlxirP4D3DeaGrDDkDQKDXEA+D0bhbUx+iO8vDiPD=xi3PzD4j40TDD5W7F7IWaAiuCkbF8fEDCIAhWYDoZeE2noAwz8fytRDHmeBwAPCmdyyYYexeGD4BirrSYnwBiDtBCw/pEa6msTOUGOlRY79u+KcjFQ9R=+uCzYSe4iiGx8v4G5qu2tUiNG0w/RYYiN0DiYGzYGDD; ssxmod_itna2=Yqfx0D9DBAeeT4eIqmq4iu0xYTxewDAQDXDUdnq7U=GcD8OD0PO+6r5GkUnEAQ05Gq0Q45omRYD==R0YwKQGnxGae+O80xTODGNqT1iDyWeKWG1DP4CEKzCguiCBPQ+ytntiBGxjLwGQlDw4hATY4AY0dIRv/AS0er0hPdwUxW7r4U72xbAifUQude8L4VRfuUmD0/gufFDLKI45mQ7GQUDx9AB4XCAR0W7md7f7huOvdSx4P/pG+k4+re9DxD; SERVERID=c6e9a4f4599611ff2779ff17d05dde80|1747499111|1747499003; tfstk=gJZsWaZHGrsngaovhVXEFMViEDoX59Sy6KMYE-KwHcntGKN4eqHwbO4bRSPs6lot6BHjIAhxHnetGmNrHVKxkh3bAAkjHdet6DdLaSYOIVHx9pHiXq4Zgfljc-V5L_SP4R2imcCPagoivBStqhLvDIuppYojBzxEkO2immCFsrBzxRVi6QFaBmBIvxMtBm3tH2BIhYGxDf3v9eH-9mnxMVhppxkSBCLtk9wKtxnxMS3OdDhnHeCNlvISZR6i-qIseK6gQXtvDkMCdbyswvcQAAgsXyhBDYrICVG8QutYbQM7PkgzWOQt9l28uo3pd9n0LzNbkJBWyjaaUlgSciOSKyeujre1A_etfXmtEy1Wjcy7J8qimK8ibzyzm4EOfQcErxwSAkCpxjz8eDsrS3lWUXLXofKxdbWCdEYme5JLx5-2leutKvvNd9T4KVHndbWCdEYmWvD3u96BuJf..; isg=BBAQ2i6nTLt-yhCXMHk2N4Wb4Vxi2fQjOuiJTgrh1Ws-RaLvsOi0sns7GFMA1az7',
                host: 'chat.qwen.ai',
                origin: 'https://chat.qwen.ai',
                referer: 'https://chat.qwen.ai/',
                'sec-ch-ua': '"Chromium";v="137", "Not/A)Brand";v="24"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'source': 'h5',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
                'version': '0.0.101',
                'x-request-id': uuidv4()
            }
  });

  let reply = data?.choices?.[0]?.message?.content || "";
  if (reply.includes("</think>")) reply = reply.split("</think>").pop().trim();
  return reply;
}

module.exports = function (app) {
  app.get("/ai/createchat", async (req, res) => {
    const { role } = req.query;
    try {
      const sessionId = await createNewSession(role);
      res.json({
        status: true,
        message: "Session berhasil dibuat",
        session_id: sessionId,
        role: role || "default"
      });
    } catch (e) {
      res.status(500).json({ status: false, message: e.message });
    }
  });

  app.get("/ai/chat", async (req, res) => {
    const { q, session } = req.query;
    if (!q || !session) {
      return res.status(400).json({ status: false, message: "Parameter 'q' dan 'session' wajib diisi." });
    }

    await deleteExpiredSessions();

    let { data: sessionData } = await supabase
      .from("ai_sessions")
      .select("*")
      .eq("user_id", session)
      .single();

    let messages;

    if (!sessionData) {
      messages = [{
        role: "system",
        content: "Kamu adalah AI ramah, Pintar, dan Sopan yang siap membantu. Nama Kamu FalcoAI."
      }];
      await supabase.from("ai_sessions").insert({
        user_id: session,
        model: "qwen",
        messages,
        updated_at: new Date()
      });
    } else {
      messages = sessionData.messages;
    }

    messages.push({ role: "user", content: q });

    try {
      const reply = await qwenai(q, messages);
      messages.push({ role: "assistant", content: reply });

      await supabase.from("ai_sessions")
        .update({ messages, updated_at: new Date() })
        .eq("user_id", session);

      res.json({
        status: true,
        session,
        response: reply
      });
    } catch (err) {
      res.status(500).json({ status: false, message: err.message });
    }
  });

  app.get("/ai/deletesession", async (req, res) => {
    const { session } = req.query;
    if (!session) return res.status(400).json({ status: false, message: "Parameter 'session' wajib." });

    try {
      await supabase.from("ai_sessions").delete().eq("user_id", session);
      res.json({ status: true, message: `Session '${session}' berhasil dihapus.` });
    } catch (e) {
      res.status(500).json({ status: false, message: e.message });
    }
  });

  app.get("/ai/clearchat", async (req, res) => {
    const { session } = req.query;
    if (!session) return res.status(400).json({ status: false, message: "Parameter 'session' wajib." });

    try {
      const { data: sessionData } = await supabase
        .from("ai_sessions")
        .select("*")
        .eq("user_id", session)
        .single();

      if (!sessionData) return res.status(404).json({ status: false, message: "Session tidak ditemukan." });

      const systemPrompt = sessionData.messages.find(m => m.role === "system");
      await supabase.from("ai_sessions")
        .update({ messages: [systemPrompt], updated_at: new Date() })
        .eq("user_id", session);

      res.json({ status: true, message: `Chat di session '${session}' berhasil dikosongkan.` });
    } catch (e) {
      res.status(500).json({ status: false, message: e.message });
    }
  });
};
