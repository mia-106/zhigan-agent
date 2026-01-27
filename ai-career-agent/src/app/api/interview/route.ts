import { NextRequest, NextResponse } from 'next/server'
import { INTERVIEW_PROMPT_TEMPLATE } from '@/lib/constants'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const { stage, role, jd, resume, history } = await request.json() as {
      stage: number
      role: string
      jd: string
      resume: string
      history: ChatMessage[]
    }

    // 格式化历史对话为文本
    const safeHistory = Array.isArray(history) ? history : []
    const previousQAs = safeHistory
      .map((msg) => `${msg.role === 'user' ? '候选人' : '面试官'}: ${msg.content}`)
      .join('\n')

    // 填充提示词模板 (使用正则全局替换)
    const systemPrompt = INTERVIEW_PROMPT_TEMPLATE
      .replace(/\${resume}/g, resume)
      .replace(/\${stage \+ 1}/g, (stage + 1).toString())
      .replace(/\${role}/g, role)
      .replace(/\${jd}/g, jd)
      .replace(/\${previousQAs}/g, previousQAs)

    if (!process.env.DEEPSEEK_API_KEY) {
      console.warn('API Key not configured, using mock response')
      return NextResponse.json({
        question: "您能详细说明一下您在简历中提到的那个关键项目吗？尤其是您在其中扮演的角色。",
        isFollowUp: false,
        internalNote: "演示模式：未配置 API Key"
      })
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          ...safeHistory
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('DeepSeek API error:', response.status, errorText)
      return NextResponse.json(
        { error: `API request failed: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    try {
      // 解析 AI 返回的 JSON
      const parsedContent = JSON.parse(content)
      return NextResponse.json(parsedContent)
    } catch {
      console.error('Failed to parse AI JSON response:', content)
      // 如果解析失败，尝试清洗 Markdown 标签
      const cleaned = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim()
      try {
        return NextResponse.json(JSON.parse(cleaned))
      } catch {
        return NextResponse.json({
          question: content, // 回退：直接返回原文
          isFollowUp: false,
          internalNote: "JSON 解析失败回退"
        })
      }
    }
  } catch (error) {
    console.error('Interview API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
