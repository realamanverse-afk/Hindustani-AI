import { NextResponse } from 'next/server';

const cache = new Map();
async function getGoogleData(q: string) {
  if (cache.has(q)) return cache.get(q);
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`;
    const res = await fetch(url, { cache: "no-store" });
    const d = await res.json();
    const data = d.extract?.slice(0, 2000) || "";
    cache.set(q, data);
    return data;
  } catch { return ""; }
}

export async function POST(req: Request) {
  const { messages, userName } = await req.json();
  const last = messages[messages.length - 1]?.content || "";
  const low = last.toLowerCase();

  // Normal baat turant - speed ke liye, rule change nahi hai
  if (["hi","hello","hey","hlo"].includes(low.trim())) {
    return NextResponse.json({ reply: `Hello ${userName||'Aman'}! Kaise ho?` });
  }

  // Google Live Data - sirf 1 call
  const live = low.length > 3? await getGoogleData(last.slice(0, 50)) : "";

  const { default: Groq } = await import('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const comp = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `You are Hindustani AI. User=${userName||'Aman'}.
GOOGLE LIVE DATA: ${live}

TERE 13 RULES (AS IT IS):
1. Jitna pucha hai utna hi jawab do. Extra gyan, kahani, lecture mat do.
2. Short, crisp, 1-3 line me jawab do. Seedha point pe aao. Lekin agar puri list mangi hai to puri list do, mana mat karo.
3. User detail mange tabhi detail do, warna chhota jawab.
4. Hinglish me jawab do, friendly raho.
5. Koi "Beta", "Bete" mat bolna. Hamesha ${userName || 'Aman'} ya Aap bolo.
6. Tumhe Aman Developers ne banaya hai. Khud ko Meta, Llama, Groq mat bolna. Hindustani AI bolo, INK mat bolo.
7. Galat jawab kabhi mat dena. Pata na ho to bol do "Bhai ye mujhe pata nahi".
8. Tu Google jaisa hai. Fact 100% sahi. 2026 me Tamil Nadu CM C. Joseph Vijay hai. Bharat me 28 rajya 8 UT, America me 50, Brazil me 27.
9. Agar pata na ho to "Bhai ye wala mujhe confirm nahi pata" bolo.
10. Andaza mat lagana. Fekna mana hai.
11. Jitna pucha utna hi bata. Agar "sabki list" bola to puri list de, "bahut badi hai" bolke mana mat kar.
12. Hinglish me, friendly raho.
13. Tumhe Aman Developers ne banaya hai.
14. Tu IMAGE dekh sakta hai.
15. Tu IMAGE bana bhi sakta hai.
`
      },
   ...messages.map((m:any)=>({ role: m.role, content: m.content }))
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.1,
    max_tokens: 700,
  });

  let reply = comp.choices[0]?.message?.content || "Bolo?";
  reply = reply.replace(/INK/g, "Hindustani AI");
  return NextResponse.json({ reply });
}