import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const buildFallbackReport = (message: string) => ({
  score: 0,
  strengths: [],
  weaknesses: [],
  detailedFeedback: message,
  suggestions: '请补充更多有效回答后再次生成复盘报告。',
  questionsAnalysis: []
})

const sanitizeReviewData = (data: any) => {
  return {
    score: typeof data.score === 'number' ? data.score : 0,
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
    detailedFeedback: data.detailedFeedback || data.feedback || data.analysis || '暂无详细分析',
    suggestions: data.suggestions || '暂无建议',
    questionsAnalysis: Array.isArray(data.questionsAnalysis) ? data.questionsAnalysis.map((q: any) => ({
      question: q.question || '未知问题',
      userAnswer: q.userAnswer || '未回答',
      referenceAnswer: q.referenceAnswer || '暂无参考回答'
    })) : []
  }
}

const limitText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

const REVIEW_PROMPT_TEMPLATE = `# Role
资深面试官。

# Task
基于对话生成精炼复盘报告(JSON)。

# Rules
1. **真实性**：仅基于对话。无回答则不得分。
2. **精炼**：语言极简，直击要点。
3. **格式**：纯JSON，无Markdown，无废话。

# Output (JSON)
{
  "score": 0-100,
  "strengths": ["亮点1", "亮点2"],
  "weaknesses": ["不足1", "不足2"],
  "detailedFeedback": "简短分析(支持Markdown)",
  "suggestions": "1-2条核心建议",
  "questionsAnalysis": [
    {
      "question": "原题",
      "userAnswer": "摘要(未回答填'未回答')",
      "referenceAnswer": "简练的核心回答要点"
    }
  ]
}

# Inputs
[Role]: \${role}
[JD]: \${jd}
[Resume]: \${resume}
[History]:
\${history}
`

export async function POST(request: NextRequest) {
  try {
    const { role, jd, resume, history } = await request.json() as {
      role: string
      jd: string
      resume: string
      history: ChatMessage[]
    }

    // 限制历史记录长度，避免 prompt 过大导致超时或失败
    const maxHistoryMessages = 15
    const safeHistory = Array.isArray(history) ? history : []
    if (safeHistory.length === 0) {
      return NextResponse.json(buildFallbackReport('对话为空，无法生成复盘报告。'))
    }
    const truncatedHistory = safeHistory.length > maxHistoryMessages
      ? safeHistory.slice(-maxHistoryMessages)
      : safeHistory

    const historyText = truncatedHistory
      .map((msg) => `${msg.role === 'user' ? '候选人' : '面试官'}: ${msg.content}`)
      .join('\n')

    console.log(`[Review API] Generating report for role: ${role}, history length: ${truncatedHistory.length}`)

    const systemPrompt = REVIEW_PROMPT_TEMPLATE
      .replace(/\${role}/g, role)
      .replace(/\${jd}/g, jd)
      .replace(/\${resume}/g, resume)
      .replace(/\${history}/g, historyText)

    if (!process.env.DEEPSEEK_API_KEY) {
      console.warn('[Review API] DEEPSEEK_API_KEY is missing, returning fallback data')
      return NextResponse.json({
        score: 0,
        strengths: [],
        weaknesses: ["未配置 API Key"],
        detailedFeedback: "系统未配置 DeepSeek API Key，无法生成真实复盘报告。请在 .env.local 中配置 DEEPSEEK_API_KEY。",
        suggestions: "联系管理员配置系统环境。",
        questionsAnalysis: []
      })
    }

    // 设置超时控制
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60秒超时

    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          stream: true
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[Review API] DeepSeek API error: ${response.status}`, errorText)
        throw new Error(`DeepSeek API returned ${response.status}: ${errorText}`)
      }

      // Streaming support logic with SSE parsing
      const stream = new ReadableStream({
        async start(controller) {
          try {
            if (!response.body) throw new Error('No response body')
            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || '' // Keep the last incomplete line

              for (const line of lines) {
                const trimmedLine = line.trim()
                if (!trimmedLine || trimmedLine === 'data: [DONE]') continue
                
                if (trimmedLine.startsWith('data: ')) {
                  try {
                    const jsonStr = trimmedLine.slice(6)
                    const data = JSON.parse(jsonStr)
                    const content = data.choices?.[0]?.delta?.content || ''
                    if (content) {
                      controller.enqueue(new TextEncoder().encode(content))
                    }
                  } catch (e) {
                    console.warn('[Review Stream] SSE parse error:', e)
                  }
                }
              }
            }
            controller.close()
          } catch (error) {
            console.error('[Review Stream] Error:', error)
            controller.error(error)
          }
        }
      })

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked'
        }
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    console.error('Interview Review API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json(buildFallbackReport(`复盘生成失败：${errorMessage}`))
  }
}
