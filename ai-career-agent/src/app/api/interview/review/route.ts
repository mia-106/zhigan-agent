import { NextRequest, NextResponse } from 'next/server'

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

const REVIEW_PROMPT_TEMPLATE = `# Role & Identity
你是一名世界500强企业的资深面试评估专家。你收到了候选人与面试官在 \${role} 环节的完整对话记录。

# Task
请基于对话记录，对候选人的表现进行深度复盘和评估。

# CRITICAL RULES (防幻觉)
1. **真实性校验**：必须基于[完整对话历史]进行评估。如果候选人没有回答问题，或者回答极其简短（如“不知道”、“好的”、“...”），严禁虚构其表现。
2. **参与度判定**：如果候选人几乎没有实质性回答，综合评分(score)必须在 0-30 分之间，并在 feedback 中明确指出其未参与面试。
3. **严禁凭空赞扬**：如果候选人表现不佳或未回答，严禁给出“技术方案理解透彻”、“表达流畅”等正面评价。

# Dimensions for Evaluation
1. **胜任力匹配度**：候选人的回答是否证明了其具备简历中所述的专业能力？
2. **逻辑与表达**：表达是否清晰、专业，是否有逻辑断层？
3. **压力与应变**：在追问环节的表现如何？
4. **真实性核实**：简历描述与口头表达是否存在严重不一致？

# Output Format (JSON)
返回一个包含以下字段的 JSON 对象：
- \`score\`: 0-100 的综合评分。
- \`strengths\`: 字符串数组，候选人表现出的 2-3 个核心亮点。如果无亮点则为空数组。
- \`weaknesses\`: 字符串数组，候选人暴露出的 2-3 个潜在风险或短板。
- \`detailedFeedback\`: 详细的定性分析报告（支持 Markdown 格式）。
- \`suggestions\`: 给候选人的改进建议。
- \`questionsAnalysis\`: 数组，包含面试中提到的每个核心问题及其分析。每个对象包含：
    - \`question\`: 面试官提问的具体内容。
    - \`userAnswer\`: 候选人的回答内容（如未回答请注明“未回答”）。
    - \`referenceAnswer\`: 针对该问题，结合职位JD和候选人简历，给出的**教科书级参考回答**。

# Inputs
[面试环节]: \${role}
[职位JD]: \${jd}
[候选人简历]: \${resume}
[完整对话历史]:
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
          temperature: 0.3, // 降低随机性，确保 JSON 格式稳定
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[Review API] DeepSeek API error: ${response.status}`, errorText)
        throw new Error(`DeepSeek API returned ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      const content = data.choices[0].message.content
      
      // 增强的 JSON 解析逻辑
      const parseJSON = (str: string) => {
        // 1. 尝试直接解析
        try {
          return JSON.parse(str)
        } catch (e) {
          // 2. 尝试移除 Markdown 标记后解析
          const cleanStr = str.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
          try {
            return JSON.parse(cleanStr)
          } catch (e2) {
            // 3. 尝试提取 JSON 对象（查找首个 { 和最后一个 }）
            const firstBrace = str.indexOf('{')
            const lastBrace = str.lastIndexOf('}')
            if (firstBrace !== -1 && lastBrace !== -1) {
              const subStr = str.substring(firstBrace, lastBrace + 1)
              try {
                return JSON.parse(subStr)
              } catch (e3) {
                 // 4. 尝试修复常见 JSON 错误（如末尾逗号）
                 let fixedStr = subStr.replace(/,(\s*[}\]])/g, '$1')
                 try {
                   return JSON.parse(fixedStr)
                 } catch (e4) {
                   // 5. 处理未转义的换行符 (DeepSeek 偶尔会输出实际换行符)
                   // 策略 A: 假设是压缩格式，直接替换为 \n (保留内容格式)
                   try {
                     const escaped = fixedStr.replace(/\n/g, '\\n').replace(/\r/g, '')
                     return JSON.parse(escaped)
                   } catch (e5) {
                     // 策略 B: 假设是 Pretty 格式，替换为空格 (牺牲内容格式以确保解析成功)
                     try {
                       const flattened = fixedStr.replace(/[\r\n]/g, ' ')
                       return JSON.parse(flattened)
                     } catch (e6) {
                       throw e // 抛出原始错误以便上层捕获
                     }
                   }
                 }
              }
            }
            throw e
          }
        }
      }

      try {
        const parsedContent = parseJSON(content)
        return NextResponse.json(sanitizeReviewData(parsedContent))
      } catch (parseError: any) {
        console.error('[Review API] JSON parse error:', parseError, 'Raw content:', content)
        return NextResponse.json(buildFallbackReport(`复盘内容解析失败: ${parseError.message}。请重试。原始输出片段：${limitText(content, 200)}`))
      }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    console.error('Interview Review API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json(buildFallbackReport(`复盘生成失败：${errorMessage}`))
  }
}
