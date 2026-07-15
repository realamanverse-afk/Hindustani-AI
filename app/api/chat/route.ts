import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { messages, userName } = await request.json()

    const systemMessage = {
      role: 'system' as const,
      content: `You are Hindustani AI INK. User ka naam ${userName || 'Bhai'} hai.

TUMHARA RULE - GOOGLE JAISA BANO:
1. Jitna pucha hai utna hi jawab do. Extra gyan, kahani, lecture mat do.
2. Short, crisp, 1-3 line me jawab do. Seedha point pe aao.
3. User detail mange tabhi detail do, warna chhota jawab.
4. Hinglish me jawab do, friendly raho.
5. Koi "Beta", "Bete" mat bolna. Hamesha ${userName || 'Bhai'} ya Aap bolo.
6. Tumhe Aman Developers ne banaya hai. Khud ko Meta, Llama mat bolna.
7. Galat jawab kabhi mat dena. Pata na ho to bol do "Bhai ye mujhe pata nahi.
8. Tu Google jaisa hai. Fact, History, Geography, Science me 100% sahi jawab dena hai.
9. Galat jawab kabhi mat dena. Agar pata na ho toh bol de "Bhai ye wala mujhe confirm nahi pata, Google kar le".
10. Andaza (guess) mat lagana. Fekna mana hai.
11. Jitna pucha utna hi bata, short me. 2-3 line me.
12. Hinglish me, friendly.
13. Tumhe Aman Developers ne banaya hai.
`
    }
    

    const chatCompletion = await groq.chat.completions.create({
      messages: [systemMessage, ...messages],
      model: 'llama-3.3-70b-versatile', // Wapas 70B pe le aaya, ye sabse tez + sahi hai
      temperature: 0.2, // 0.2 matlab bilkul sahi bolega, fekega nahi
      max_tokens: 500,
    })
    const reply = chatCompletion.choices[0]?.message?.content || 'Kuch gadbad hai bhai'
    return NextResponse.json({ reply: reply })

  } catch (error: any) {
    console.error('GROQ API ERROR FULL:', error)

    if (error?.status === 429 || error?.error?.code === 'rate_limit_exceeded') {
      return NextResponse.json({
        reply: 'Bhai ruk ja 10 sec 1 min me 30 message ki limit hai. Dheere-dheere bhej.'
      })
    }

    if (error?.status === 401 || error?.error?.code === 'invalid_api_key') {
      return NextResponse.json({
        reply: 'Bhai API Key set nahi hai. Vercel me GROQ_API_KEY check kar.'
      })
    }

    return NextResponse.json({
      reply: `Bhai error: ${error?.error?.message || error?.message || 'Server busy'}`
    })
  }
}
