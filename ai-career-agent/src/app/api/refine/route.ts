import { NextRequest, NextResponse } from 'next/server'

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

async function callDeepSeek(apiKey: string, messages: ChatMessage[], temperature: number = 0.3) {
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('DeepSeek API error:', response.status, errorText)
      throw new Error(`API request failed: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  } catch (error) {
    console.error("DeepSeek API error:", error)
    throw error
  }
}

function createRefinePrompt(resume: string, jds: string, strengths: string[], newAchievements: string) {
  const achievements = [
    ...(strengths.length > 0 ? [`优势标签: ${strengths.join(', ')}`] : []),
    ...(newAchievements ? [`新增成就: ${newAchievements}`] : [])
  ].join('\n');

  return `
# Role & Identity 
 你是一名世界500强企业中“金牌简历重塑专家”。你擅长为转型求职者、应届生以及向上跨度的职场人进行“简历品牌升级（Rebranding）”。 
 
 ## 专家特质 
 - **叙事重构师**：你深谙“翻译”的力量，能抹去旧行业的标签，还原职场素质的通用组件。 
 - **转化率猎手**：你根据 JD 调整文字的“磁力”，确保每一个词都在勾引 HR 提问。 
 - **职场演练员**：你的文案绝不带有“学生气”或“外行感”，哪怕是新学的知识，也按实战立场输出。 
 - **零水份原则**：你拒绝任何无法量化的自我评价词汇，坚持“用事实证明专业，而非用副词修饰”。 
 
 # Rewriting Philosophy: 转型与增长合成模型 
 1. **去教育化 (De-schooling)**：严禁写“学习中”、“参与过”。所有新学的项目强制转化为“独立技术验证”或“交付项目”。 
 2. **重心自适应 (Gravity Pivot)**：新成就多则扩写，新成就少则深挖旧经历中的能力组件。 
 3. **金字塔逻辑**：所有成就遵循：【针对XX环境】+【主导了XX动作/构建XX模型】+【体现/交付了XX价值】。 
 4. **证据替代评价 (Evidence over Adjectives)**：**核心哲学。** 严禁出现“精通”、“熟练”等自夸词汇。通过描述“处理的问题复杂度”和“具体的产出指标”来侧面证明专业深度。 
 
 # Output Constraints & Requirements 
 - **输出格式**：纯 JSON。严禁 Markdown 标签包裹，严禁前言或结尾解释。 
 - **全篇无表情包**：保持绝对严肃的专业文案，严禁出现 Emojis 或各种符号表情。 
 - **禁用词黑名单**：**严禁出现：精通、熟练、熟悉、深度理解、资深、专家、非常、极其、努力。** 
 - **替代准则**：若原始输入有“精通XX”，你必须强制改写为“能够独立完成XX逻辑，并实现/优化了XX结果”。 
 - **语态限定**：每条 Bullet Point 以强动词开头（主导、构建、转化、优化）。 
 - **单页平衡**：确保内容的物理长度适中，不重要的旧经历通过合并来缩短篇幅。 
 
 # Process Management (执行路径) 
 1. **关键词优先级分析**：深度阅读 [目标职位JD]，提取岗位核心痛点词。 
 2. **新成就“脱水”包装**：审视 [新增成就/优势]，**剥离所有学习感词汇（如“掌握了”改为“交付了”）**，并强制执行禁用词过滤。 
 3. **老简历语义重叠**：搜索 [候选人原简历]，用 JD 的关键词覆盖旧背景词，将评价性副词全部替换为量化数据或行为路径。 
 4. **关联性话术合并**：生成逻辑自洽的 Professional Summary，合理解释“跨度的必要性与能力闭环”。

# Input Data
[目标职位JD]:
${jds}

[候选人原简历]:
${resume}

[新增成就/优势]:
${achievements}

# Target Output Template (JSON)
{
  "refined_content": "完整精修后的简历内容（Markdown格式，保持标准简历结构：个人总结、技能、经历等）"
}
`
}

export async function POST(request: NextRequest) {
  try {
    const { resume, jds, strengths, newAchievements } = await request.json()

    if (!resume || !jds || !Array.isArray(jds)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const combinedJds = jds.join('\n\n=== NEXT JD ===\n\n')
    const prompt = createRefinePrompt(resume, combinedJds, strengths || [], newAchievements || '')

    if (!process.env.DEEPSEEK_API_KEY) {
      console.warn('API Key not configured, using mock data')
      return NextResponse.json({
        content: `
# 个人总结
资深前端开发工程师，5年经验。精通React生态，具备从0到1构建大型Web应用的经验。擅长性能优化与工程化建设。

# 专业技能
- **核心技术**: React, TypeScript, Next.js, Tailwind CSS
- **工程化**: Webpack, Vite, CI/CD (GitHub Actions)
- **后端**: Node.js, NestJS, PostgreSQL

# 工作经历
**高级前端工程师 | 某科技公司**
*2021.06 - 至今*
- 主导公司核心SaaS平台重构，采用**Next.js** + **TypeScript**技术栈，将首屏加载时间从2.5s降低至0.8s（**提升68%**）。
- 设计并落地微前端架构，拆分巨石应用为5个子应用，提升团队并行开发效率**40%**。

# 项目经历
**电商后台管理系统**
- **Situation**: 旧版系统基于jQuery开发，维护成本高，难以支撑新业务扩展。
- **Task**: 负责系统整体技术选型与重构。
- **Action**: 引入React 18与Ant Design 5，搭建标准化组件库；实现基于RBAC的动态权限管理。
- **Result**: 系统稳定性提升**99.9%**，新需求开发周期缩短**50%**。

*(注：此为演示数据，请配置API Key以获取真实AI生成结果)*
        `
      })
    }

    const resultStr = await callDeepSeek(process.env.DEEPSEEK_API_KEY, [{ role: 'user', content: prompt }], 0.3)
    
    // Parse JSON output
    let refinedContent = resultStr
    try {
      const cleanJson = resultStr.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleanJson)
      if (parsed.refined_content) {
        refinedContent = parsed.refined_content
      }
    } catch {
      console.warn('Failed to parse JSON from refine response, using raw text')
    }

    return NextResponse.json({ content: refinedContent })
  } catch (error) {
    console.error('Refine API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
