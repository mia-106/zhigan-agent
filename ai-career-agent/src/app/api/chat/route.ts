import { NextRequest, NextResponse } from 'next/server'
import { COPILOT_PROMPT_TEMPLATE } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    const { messages, temperature = 0.2, context } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 })
    }

    // Construct System Prompt
    const lastMessage = messages[messages.length - 1]
    const userQuestion = lastMessage?.role === 'user' ? lastMessage.content : ''
    
    const systemPrompt = COPILOT_PROMPT_TEMPLATE
      .replace('{{context}}', JSON.stringify(context || {}, null, 2))
      .replace('{{question}}', userQuestion)

    const messagesWithSystem = [
      { role: 'system', content: systemPrompt },
      ...messages
    ]

    if (!process.env.DEEPSEEK_API_KEY) {
      console.warn('API Key not configured, using mock response')
      return NextResponse.json({
        content: "这是一个模拟的回复。由于未配置 DeepSeek API Key，系统运行在演示模式下。请在服务器端配置正确的 API Key 以启用完整功能。"
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
        messages: messagesWithSystem,
        temperature: temperature,
        stream: false,
        tools: [
          {
            type: "function",
                function: {
                  name: "update_resume",
                  description: "Update a specific section of the resume with new content. Use this tool when you need to modify the resume based on user request.",
                  parameters: {
                    type: "object",
                    properties: {
                      section: {
                        type: "string",
                        enum: ["basicInfo", "summary", "experience", "skills", "education", "projects"],
                        description: "The section of the resume to update."
                      },
                      content: {
                        type: "string",
                        description: "The new content for the section. format as Markdown string."
                      }
                    },
                    required: ["section", "content"]
                  }
                }
              },
              {
                type: "function",
                function: {
                  name: "rewrite_resume",
                  description: "Rewrite the ENTIRE resume content. Use this tool when the user wants a full rewrite, or when previous section updates failed, or when you need to restructure the whole document.",
                  parameters: {
                    type: "object",
                    properties: {
                      full_content: {
                        type: "string",
                        description: "The complete, rewritten resume content in Markdown format."
                      }
                    },
                    required: ["full_content"]
                  }
                }
              }
            ]
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
      console.log('DeepSeek Response:', JSON.stringify(data, null, 2)) // Add logging

      const message = data.choices[0].message
      
      return NextResponse.json({
        content: message.content,
        tool_calls: message.tool_calls
      })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}