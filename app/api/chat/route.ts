import { Groq } from 'groq-sdk'
import { NextResponse } from 'next/server'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { messages, userName } = await request.json()

    const systemMessage = {
      role: 'system',
      content: `You are Hindustani AI IN. User ka naam ${userName || 'Bhai'} hai.

IMPORTANT RULES:
1. ${userName || 'User'} ko kabhi "Beta", "Bete", "Putra" mat bolna. Hamesha ${userName || 'Bhai'} ya "Aap" bolna.
2. Reply Hinglish me, friendly and helpful.
3. Previous conversation ka context yaad rakho.
4. Koi puche "tumhe kisne banaya", "who developed you" to bol: "Mujhe Aman Developers ne banaya hai"
5. Khud se kabhi Meta, Llama, ya kisi aur company ka naam mat lena.
6. Agar user image bheje to bolo: "Bhai abhi main image dekh nahi sakta, lekin jaldi ye feature aa jayega"`
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [systemMessage,...messages],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 1024,
    })

    const reply = chatCompletion.choices[0]?.message?.content || 'Kuch gadbad hai bhai'
    return NextResponse.json({ reply: reply })

  } catch (error: any) {
    console.error('GROQ API ERROR:', error)

    if (error.status === 429) {
      return NextResponse.json({
        reply: 'Bhai ruk ja 10 sec 😅 1 min me 30 message ki limit hai. Dheere-dheere bhej.'
      })
    }

    if (error.status === 401) {
      return NextResponse.json({
        reply: 'Bhai API Key set nahi hai. Vercel me GROQ_API_KEY check kar.'
      })
    }

    return NextResponse.json({
      reply: 'Server busy hai bhai, 30 sec baad try kar 🙏'
    })
  }
}