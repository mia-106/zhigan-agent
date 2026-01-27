import { NextRequest, NextResponse } from 'next/server'

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

type DeepSeekMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callDeepSeek(apiKey: string, messages: DeepSeekMessage[], temperature: number = 0.2) {
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

function createDiagnosticPrompt(jds: string, resume: string, prepDays: number, dailyHours: number) {
  return `
# Role & Identity 
 你是一名世界500强企业中“最具洞察力的资深首席人才甄选官”。你拥有20年人才招募与职场转型辅导经验。 
 
 ## 性格基调 
 1. **算法般的冷酷 (The Cold Sieve)**：你深知初筛只有6秒。你像 ATS 系统一样严厉扫描简历中的关键词缺失、逻辑空洞和数据缺失。 
 2. **伯乐般的敏锐 (The Warm Mentor)**：你擅长在碎石中挖掘“隐形金子”，为转行者和大学生识别可迁移能力（Transferable Power）。 
 3. **原则**：评分要真，点评要暖。揭示差距是为了赋予力量。 
 
 # Core Philosophy: OEP 胜任力评估模型 
 1. **Outcomes (产出 - 权重40%)**：不仅看“做过什么”，更看“做成了什么”。寻找数字、ROI和成果。 
 2. **Evidence (证据 - 权重40%)**：严格对照 JD 关键词。没有实操证据的技能一律视为“概念了解”。 
 3. **Potential & Transferability (潜能与迁移 - 权重20%)**：挖掘候选人原领域中可撬开新领域大门的杠杆能力。 
 
 # Knowledge & Skill Taxonomy 
 - **硬技能 (Hard Capabilities)**：行业工具、理论框架、专业证照。 
 - **可迁移实力 (Transferable Power)**：逻辑架构、抗压力、冲突处理。这部分是新人的核心加分项。 
 - **经验等级 (Experience Depth)**： 
     - Lv.1 执行层 (单纯配合) -> 30%价值评估 
     - Lv.2 负责层 (闭环主导) -> 80%价值评估 
     - Lv.3 影响力层 (降本增效) -> 120%价值评估 
 
 # Diagnostic Workflow (内部推理逻辑) 
 1. **业务解析**：扫描 JD，反向推导面试官最担心的 3 个关于“转行/新手入职后做不好”的疑虑。 
 2. **脱水扫描**：利用“经验等级”剥离简历中的虚词。 
 3. **位移分析**：计算事实与期待的位移。**若总准备时间极短，策略将自动从“知识补齐”转向“面试防御”**。 
 4. **情感校准**：低分时加大潜力挖掘篇幅以建立信心；高分时侧重精细化补缺以防自满。 
 
 # Output Constraints & Formatting 
 - **唯一输出格式**：必须仅返回一个纯 JSON 结构。**严禁**任何 Markdown 代码块标签包裹，严禁任何前缀文字或解释性后缀。 
 - **严禁使用表情**：**全篇内容禁止出现任何表情包 (Emojis) 或符号表情 (Emoticons)**，保持职场文档的专业肃穆感。 
 - **文案要求**： 
     - 评分项：使用专业招聘术语。 
     - 点评项：文字温润且具有极强的前进推力，必须针对性极强，拒绝陈词滥调。 
     - 建议项：具体到可搜索的关键词、工具名或实操话术模版。 
 
 # Input Variables (数据输入) 
 [准备时间]: ${prepDays} 天, 每天 ${dailyHours} 小时 
 [目标职位JD]: ${jds} 
 [候选人简历]: ${resume} 
 
 # Target Output Template (JSON) 
 { 
   "summary": { 
     "total_score": 0, 
     "career_persona": "例如：极具厚度的转行潜力者", 
     "short_feedback": "一句暖心且直击要害的总评（严禁表情包）" 
   }, 
   "deep_diagnostic": { 
    "interviewer_fears": ["面试官对该候选人的2个核心顾虑"], 
    "hidden_gems": ["候选人最能跨领域复用的1个关键潜能及其理由"],
    "flash_points": ["3-5个简短的个人优势关键词（<10字），用于简历标签"]
  }, 
   "skills_matrix": { 
     "hard_skills": { 
       "matched": ["已掌握的硬技能"], 
       "gaps": ["需填补的硬性缺口"], 
       "comment": "冷静指出Gap的描述" 
     }, 
     "transferable_power": { 
       "lever_found": "用户以前做的哪件事可支撑现在的岗位需求", 
       "impact": "为什么这能建立信任" 
     } 
   }, 
   "optimization_tips": [ 
     { 
       "original_text": "简历原句", 
       "suggested_text": "修改后的话术（严禁表情包）", 
       "why": "修改逻辑说明" 
     } 
   ], 
   "learning_strategy": { 
    "type": "突击型(话术/突击) / 扎实型(补全知识)", 
    "priority_zero": "如果你未来24小时只做一件事，请做这件事", 
    "timeline": [
       { "stage": "阶段1 (如 Day 1-3)", "task": "具体任务内容" },
       { "stage": "阶段2", "task": "..." }
    ], 
    "interview_defense": "针对面试官疑虑，提供一套针对性的防御性自我介绍/回答话术" 
    },
     "radar_data": {
       "score": 85,
       "matchAnalysis": [
         { "dimension": "硬技能", "score": 80, "analysis": "硬技能匹配度分析" },
         { "dimension": "软实力", "score": 85, "analysis": "软实力匹配度分析" },
         { "dimension": "潜力", "score": 90, "analysis": "发展潜力分析" },
         { "dimension": "经验", "score": 75, "analysis": "经验深度分析" },
         { "dimension": "匹配度", "score": 88, "analysis": "整体匹配度分析" }
       ]
     }
   }
  `
}

export async function POST(request: NextRequest) {
  try {
    const { jds, resume, prepDays = 14, dailyHours = 2 } = await request.json()

    if (!jds || !resume) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    if (!Array.isArray(jds) || jds.length === 0) {
      return NextResponse.json({ error: 'Invalid JD format' }, { status: 400 })
    }

    const combinedJds = jds.join('\n\n=== NEXT JD ===\n\n')
    const prompt = createDiagnosticPrompt(combinedJds, resume, prepDays, dailyHours)

    if (!process.env.DEEPSEEK_API_KEY) {
      console.warn('API Key not configured, using mock data for demonstration')
      return NextResponse.json({
        summary: {
          total_score: 75,
          career_persona: "潜力型技术转行者",
          short_feedback: "基础扎实但缺乏实战厚度，建议从“做过”向“做成”转化。"
        },
        deep_diagnostic: {
          interviewer_fears: [
            "面对高并发场景是否具备独立排查问题的能力",
            "是否习惯于小团队作战而难以适应大厂规范化流程"
          ],
          hidden_gems: [
            "具备跨学科学习能力，能快速理解复杂业务逻辑"
          ],
          flash_points: [
            "跨学科学习能力",
            "快速技术攻关",
            "项目推进意识",
            "SSR性能优化"
          ]
        },
        skills_matrix: {
          hard_skills: {
            matched: ["React", "TypeScript", "Tailwind CSS"],
            gaps: ["Microservices", "Kubernetes", "System Design"],
            comment: "前端技术栈掌握熟练，但后端及架构设计能力薄弱。"
          },
          transferable_power: {
            lever_found: "过往在传统行业的项目管理经验",
            impact: "这表明你具备良好的沟通协调能力和项目推进意识，能有效降低沟通成本。"
          }
        },
        optimization_tips: [
          {
            original_text: "负责公司官网开发",
            suggested_text: "主导公司官网重构，通过Next.js SSR技术优化首屏加载速度提升40%，带动SEO流量增长20%。",
            why: "原句只描述了动作，修改后增加了量化成果和具体技术手段，体现了Lv.2负责层的价值。"
          }
        ],
        learning_strategy: {
          type: "突击型(话术/突击)",
          priority_zero: "针对JD中的微服务架构，梳理一套标准的面试应答逻辑。",
          timeline: [
            { stage: "Day 1", task: "深入理解微服务核心概念" },
            { stage: "Day 2", task: "模拟高并发场景下的故障排查演练" },
            { stage: "Day 3", task: "整理项目难点与解决方案话术" }
          ],
          interview_defense: "虽然我目前在微服务架构的实操经验较少，但我具备扎实的单体应用开发基础，并且正在通过构建Side Project来补充相关知识。我自信能快速适应团队的技术栈。"
        },
        radar_data: {
          score: 75,
          matchAnalysis: [
            { dimension: "硬技能", score: 70, analysis: "前端技术栈掌握熟练，但后端薄弱" },
            { dimension: "软实力", score: 85, analysis: "沟通与协作能力突出" },
            { dimension: "潜力", score: 90, analysis: "具备极强的跨学科学习能力" },
            { dimension: "经验", score: 65, analysis: "缺乏大型分布式系统实战经验" },
            { dimension: "匹配度", score: 75, analysis: "整体匹配度良好，需补齐短板" }
          ]
        }
      })
    }

    const resultStr = await callDeepSeek(process.env.DEEPSEEK_API_KEY, [{ role: 'user', content: prompt }], 0.3)
    console.log('AI Response:', resultStr)

    // Clean up JSON markdown if present
    const cleanJson = resultStr.replace(/```json/g, '').replace(/```/g, '').trim()
    let scoreObj;
    try {
      scoreObj = JSON.parse(cleanJson)
    } catch {
      console.error('Failed to parse AI response as JSON:', cleanJson)
      // Attempt to extract JSON if there's surrounding text
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        scoreObj = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('AI response is not valid JSON')
      }
    }

    // Since the AI follows the template in createDiagnosticPrompt, 
    // we can use scoreObj directly with some basic structure validation.
    // We'll ensure all required fields exist to prevent frontend errors.
    
    // Normalize learning_strategy
    const learningStrategy = scoreObj.learning_strategy || {};
    let normalizedTimeline = learningStrategy.timeline || [];
    
    // If timeline is an object with a plan string, or just a string, try to convert it to an array
    if (!Array.isArray(normalizedTimeline)) {
      const planText = typeof normalizedTimeline === 'string' 
        ? normalizedTimeline 
        : (normalizedTimeline.plan || "");
      
      if (planText) {
         // Split by markers like "Day X", "第X天", or newlines
         const parts = planText.split(/(?=第?\d+[-~至]\d+天|第?\d+天|Day\s*\d+)/i).filter(Boolean);
         if (parts.length > 1) {
           normalizedTimeline = parts.map((part: string) => {
             // Extract stage and task, handling separators like colon or space
             const match = part.match(/^(第?\d+[-~至]\d+天|第?\d+天|Day\s*\d+)([:：\s]*)([\s\S]*)/i);
             if (match) {
               return { 
                 stage: match[1].trim(), 
                 task: match[3].trim().replace(/^[:：\s]+/, '') 
               };
             }
             return { stage: "计划", task: part.trim() };
           });
         } else {
           normalizedTimeline = planText; // Keep as string if it's just one block
         }
       }
    }

    const finalResult = {
      summary: scoreObj.summary || {
        total_score: 0,
        career_persona: "诊断失败",
        short_feedback: "无法生成有效反馈，请重试。"
      },
      deep_diagnostic: scoreObj.deep_diagnostic || {
        interviewer_fears: [],
        hidden_gems: [],
        flash_points: []
      },
      skills_matrix: scoreObj.skills_matrix || {
        hard_skills: { matched: [], gaps: [], comment: "" },
        transferable_power: { lever_found: "", impact: "" }
      },
      optimization_tips: scoreObj.optimization_tips || [],
      learning_strategy: {
        ...learningStrategy,
        type: learningStrategy.type || "未知",
        priority_zero: learningStrategy.priority_zero || "",
        timeline: normalizedTimeline,
        interview_defense: learningStrategy.interview_defense || ""
      },
      radar_data: scoreObj.radar_data || {
        score: 0,
        matchAnalysis: []
      }
    };

    return NextResponse.json(finalResult);
  } catch (error) {
    console.error('Diagnostic API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
