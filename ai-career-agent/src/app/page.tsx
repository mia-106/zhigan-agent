'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '@/hooks/use-app'
import { LOADING_MESSAGES, INTERVIEWER_PERSONAS } from '@/lib/constants'
import { RadarChart } from '@/components/RadarChart'
import {
  IconUpload,
  IconCheck,
  IconChevronRight,
  IconAlert,
  IconSend,
  IconRefresh,
  IconFileText,
  IconMessageSquare,
  IconX,
  IconTrash
} from '@/components/icons'

import ReactMarkdown from 'react-markdown'

type ReviewQuestionAnalysis = {
  question: string
  userAnswer: string
  referenceAnswer: string
}

type ReviewData = {
  score?: number
  strengths?: string[]
  detailedFeedback?: string
  questionsAnalysis?: ReviewQuestionAnalysis[]
  weaknesses?: string[]
  suggestions?: string
}

type InterviewHistoryRecord = {
  id: string
  date: string
  persona: string
  reviewData: ReviewData
  chatHistory: { role: string; content: string; metadata?: { isFollowUp?: boolean; internalNote?: string } }[]
}
type InterviewPersonaId = 'TA' | 'HM' | 'Director'
type OptimizationTip = { original_text: string; suggested_text: string; why: string }
type LearningTimelineItem = { stage: string; task: string }
type MarkdownCodeProps = {
  inline?: boolean
  className?: string
  children?: ReactNode
} & React.HTMLAttributes<HTMLElement>

const HomePage = () => {
  const {
    state,
    navigateTo,
    setActiveTab,
    setJobDescriptions,
    setResumeText,
    isCopilotOpen,
    toggleCopilot,
    isCopilotLoading,
    setIsCopilotLoading,
    copilotMessages,
    copilotInput,
    setCopilotInput,
    setCopilotMessages,
    clearCopilotMessages,
    setIsAnalyzing,
    setDiagnosticResult,
    setRefinementStep,
    setStrategyData,
    setRefinedContent,
    setInterviewStatus,
    setInterviewPersona,
    setChatHistory,
    setInputMessage,
    setReviewData,
    addInterviewHistory,
    deleteInterviewHistory,
    clearAllData
  } = useApp()

  const [loadingText, setLoadingText] = useState('')
  const [prepDays, setPrepDays] = useState(14)
  const [dailyHours, setDailyHours] = useState(2)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragType, setDragType] = useState<'copilot' | 'button' | null>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const hasMovedRef = useRef(false)
  const [customStrengths, setCustomStrengths] = useState<string[]>([])
  const [newStrengthInput, setNewStrengthInput] = useState('')
  const [loadingType, setLoadingType] = useState<'diagnostic' | 'refinement'>('diagnostic')
  const [previewVersion, setPreviewVersion] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<InterviewHistoryRecord | null>(null)
  const [pendingUpdate, setPendingUpdate] = useState<{
    type: 'update'
    section: string
    content: string
  } | {
    type: 'rewrite'
    fullContent: string
  } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 加载消息循环
  useEffect(() => {
    // 自动修复损坏的 copilotMessages 状态
    if (!Array.isArray(state.copilotMessages)) {
      console.warn('Resetting corrupted copilotMessages state')
      setCopilotMessages([
        { role: 'assistant', content: '你好！我是你的简历 AI 助手。你可以问我关于简历修改的问题，或者直接让我帮你优化某段经历。' }
      ])
    }
    
    // 自动修复损坏的 chatHistory 状态
    if (!Array.isArray(state.chatHistory)) {
        console.warn('Resetting corrupted chatHistory state')
        setChatHistory([])
    }

    let interval: NodeJS.Timeout
    if (state.isAnalyzing) {
      const messages = LOADING_MESSAGES[loadingType]
      setLoadingText(messages[0])
      let index = 0
      interval = setInterval(() => {
        index = (index + 1) % messages.length
        setLoadingText(messages[index])
      }, 2500)
    }
    return () => clearInterval(interval)
  }, [state.isAnalyzing, loadingType, state.copilotMessages, state.chatHistory, setCopilotMessages, setChatHistory])

  // Copilot聊天自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [copilotMessages, state.chatHistory, state.isAnalyzing])

  // 拖拽功能
  const handleMouseDown = (e: React.MouseEvent, type: 'copilot' | 'button') => {
    setIsDragging(true)
    setDragType(type)
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    hasMovedRef.current = false

    const selector = type === 'copilot' ? '.copilot-container' : '.copilot-toggle-button'
    const element = document.querySelector(selector) as HTMLElement
    if (element) {
      const rect = element.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragType) return
    
    // Check if moved enough to be considered a drag
    if (Math.abs(e.clientX - dragStartPos.current.x) > 5 || Math.abs(e.clientY - dragStartPos.current.y) > 5) {
      hasMovedRef.current = true
    }

    const selector = dragType === 'copilot' ? '.copilot-container' : '.copilot-toggle-button'
    const element = document.querySelector(selector) as HTMLElement
    if (element) {
      const x = e.clientX - dragOffset.x
      const y = e.clientY - dragOffset.y

      // 限制在窗口内
      const maxX = window.innerWidth - element.offsetWidth - 20
      const maxY = window.innerHeight - element.offsetHeight - 20

      element.style.left = `${Math.max(10, Math.min(x, maxX))}px`
      element.style.top = `${Math.max(10, Math.min(y, maxY))}px`
      element.style.right = 'auto'
      element.style.bottom = 'auto'
    }
  }, [dragOffset, dragType, isDragging])

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)

      const currentDragType = dragType
      const selector = currentDragType === 'copilot' ? '.copilot-container' : '.copilot-toggle-button'
      const element = document.querySelector(selector) as HTMLElement
      
      if (element && currentDragType) {
        localStorage.setItem(`${currentDragType}-position`, JSON.stringify({
          left: element.style.left,
          top: element.style.top
        }))
      }
      // Note: we don't clear hasMovedRef here, it's used by the click handler
      setDragType(null)
    }
  }, [dragType, isDragging])

  // 初始化拖拽事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, handleMouseMove, handleMouseUp])

  // 初始化Copilot和按钮位置
  useEffect(() => {
    // Restore Copilot position
    const savedCopilotPos = localStorage.getItem('copilot-position')
    if (savedCopilotPos) {
      const { left, top } = JSON.parse(savedCopilotPos)
      const copilot = document.querySelector('.copilot-container') as HTMLElement
      if (copilot) {
        copilot.style.left = left
        copilot.style.top = top
        copilot.style.right = 'auto'
        copilot.style.bottom = 'auto'
      }
    }

    // Restore Toggle Button position
    const savedButtonPos = localStorage.getItem('button-position')
    if (savedButtonPos) {
      const { left, top } = JSON.parse(savedButtonPos)
      const button = document.querySelector('.copilot-toggle-button') as HTMLElement
      if (button) {
        button.style.left = left
        button.style.top = top
        button.style.right = 'auto'
        button.style.bottom = 'auto'
      }
    }
  }, [isCopilotOpen]) // Re-run when copilot opens to ensure position is applied to new DOM element

  // 处理 JD 更新
  const handleJdChange = (index: number, value: string) => {
    const newJds = [...state.jobDescriptions]
    newJds[index] = value
    setJobDescriptions(newJds)
  }

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setIsParsing(true)
      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'PDF解析失败')
        }

        const data = await response.json()
        setResumeText(data.text)
      } catch (error) {
        console.error('File upload error:', error)
        alert('文件上传失败：' + (error instanceof Error ? error.message : '未知错误'))
      } finally {
        setIsParsing(false)
        // Clear the input value to allow uploading the same file again if needed
        event.target.value = ''
      }
    }
  }

  // 运行诊断
  const runDiagnostic = async () => {
    if (!state.resumeText || !state.jobDescriptions[0]) {
      alert('请填写简历和至少一个JD')
      return
    }

    setIsAnalyzing(true)
    setLoadingType('diagnostic')

    try {
      const response = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jds: state.jobDescriptions.filter(jd => jd.trim()),
          resume: state.resumeText,
          prepDays,
          dailyHours
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '诊断请求失败')
      }

      const result = await response.json()
      setDiagnosticResult(result)
    } catch (error) {
      console.error('Diagnostic error:', error)
      alert('诊断失败：' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setIsAnalyzing(false)
    }
  }

  // AI Copilot 输入处理
  // Helper function to update resume sections
  const normalizeRefinedContent = (content: string) => {
    const normalized = String(content || '').replace(/\r\n/g, '\n').trim()
    if (!normalized) return ''
    
    const hasMarkdownHeading = /^#{1,6}\s+/m.test(normalized)
    const hasMarkdownList = /^[\s]*[-*+]\s+/m.test(normalized)
    if (hasMarkdownHeading || hasMarkdownList) return normalized

    const headingMap = new Set([
      '基本信息', '个人总结', '自我评价', '专业技能', '核心技能', '工作经历', '项目经验', '教育背景',
      'Summary', 'Professional Summary', 'Skills', 'Technical Skills', 'Experience', 'Projects', 'Education'
    ])

    return normalized
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (!trimmed) return ''
        if (headingMap.has(trimmed.replace(/[:：]$/, ''))) return `## ${trimmed}`
        const bulletMatch = trimmed.match(/^[•·●○∙\-–—]\s*(.+)$/)
        if (bulletMatch) return `- ${bulletMatch[1].trim()}`
        return trimmed
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
  }

  const updateResumeContent = (currentContent: string, section: string, newContent: string) => {
    const updatedContent = (currentContent || '').replace(/\r\n/g, '\n')
    newContent = newContent.trim()
    
    // 1. 定义章节关键词映射
    const getSectionKey = (line: string): string => {
        // 预处理：移除Markdown标题标记、加粗标记、首尾空格
        let cleanLine = line
            .replace(/^#{1,6}\s*/, '')
            .replace(/^\*\*/, '')
            .replace(/\*\*$/, '')
            .trim()
        
        // 检查是否为列表项（以 - * + • 等开头），如果是则肯定不是标题
        if (/^[\-\*\+\•\·]\s+/.test(line.trim())) return ''
        
        // 检查是否有冒号，且冒号后有实质内容（说明是键值对而非标题）
        // 标题通常是 "Section:" 或 "Section"
        // 内容通常是 "Label: Value"
        const colonMatch = cleanLine.match(/[:：]/)
        if (colonMatch) {
            const afterColon = cleanLine.substring(colonMatch.index! + 1).trim()
            // 如果冒号后面有超过5个字符的内容，视为普通行
            if (afterColon.length > 5) return ''
            // 移除冒号以便匹配
            cleanLine = cleanLine.replace(/[:：]\s*$/, '').trim()
        }

        // 长度检查：标题通常较短
        // 中文标题通常 < 10 字，英文 < 30 字符
        if (cleanLine.length > 40) return ''

        cleanLine = cleanLine.toLowerCase()
        if (!cleanLine) return ''
        
        const map: Record<string, string> = {
            'summary': 'summary', 'professional summary': 'summary', '个人总结': 'summary', '自我评价': 'summary', '总结': 'summary',
            'experience': 'experience', 'work experience': 'experience', 'work history': 'experience', '工作经历': 'experience', '工作履历': 'experience', '职业经历': 'experience', '实习经历': 'experience',
            'projects': 'projects', 'project experience': 'projects', '项目经验': 'projects', '项目经历': 'projects',
            'skills': 'skills', 'technical skills': 'skills', 'core skills': 'skills', '核心技能': 'skills', '专业技能': 'skills', '专业能力': 'skills', '技能清单': 'skills', '技术栈': 'skills',
            'education': 'education', '教育背景': 'education', '教育经历': 'education', '学历信息': 'education',
            'basic info': 'basicInfo', 'basic information': 'basicInfo', 'contact': 'basicInfo', '基本信息': 'basicInfo', '联系方式': 'basicInfo'
        }
        
        if (map[cleanLine]) return map[cleanLine]
        
        // 模糊匹配 (仅在非精确匹配时使用，且需更严格)
        // 必须确保 cleanLine 本身就是关键词的某种形式，而不是包含关键词的句子
        // 例如 "My Project Experience" OK, "I have project experience" NO
        
        // 这里的逻辑还是有点危险，但配合长度限制和冒号检查应该好很多
        if (cleanLine.includes('summary') || cleanLine.includes('总结')) return 'summary'
        if ((cleanLine.includes('experience') || cleanLine.includes('经历') || cleanLine.includes('履历')) && !cleanLine.includes('项目')) return 'experience'
        if (cleanLine.includes('project') || cleanLine.includes('项目')) return 'projects'
        if (cleanLine.includes('skill') || cleanLine.includes('技能') || cleanLine.includes('能力')) return 'skills'
        if (cleanLine.includes('education') || cleanLine.includes('教育') || cleanLine.includes('学历')) return 'education'
        if (cleanLine.includes('basic') || cleanLine.includes('info') || cleanLine.includes('基本信息')) return 'basicInfo'
        
        return ''
    }

    // 2. 将简历切分为章节
    const lines = updatedContent.split('\n')
    const sections: { key: string; header: string; content: string[] }[] = []
    let currentSection = { key: '', header: '', content: [] as string[] }
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()
        
        // 判定是否为标题行
        const key = getSectionKey(trimmed)
        
        if (key) {
             // 发现新章节，保存旧章节
             if (currentSection.header || currentSection.content.length > 0) {
                 sections.push(currentSection)
             }
             // 开始新章节
             currentSection = { key, header: line, content: [] }
        } else {
            currentSection.content.push(line)
        }
    }
    // 保存最后一个章节
    if (currentSection.header || currentSection.content.length > 0) {
        sections.push(currentSection)
    }

    // 3. 查找并替换目标章节
    // 优先匹配 key，如果 key 重复（如多段经历），这里简单逻辑是只替换第一个匹配到的 summary/skills/education/basicInfo
    // 对于 experience/projects，通常是一个大章节包含多个项目，或者多个小章节。
    // 这里的逻辑假设 resume 是标准化的：每个大类只有一个一级标题。
    const targetIndex = sections.findIndex(s => s.key === section)
    
    if (targetIndex !== -1) {
        sections[targetIndex].content = newContent.split('\n')
    } else {
        console.warn(`Section ${section} not found, appending.`)
        const headerMap: Record<string, string> = {
           basicInfo: '## 基本信息',
           summary: '## 个人总结',
           experience: '## 工作经历',
           skills: '## 核心技能',
           education: '## 教育背景',
           projects: '## 项目经验'
        }
        sections.push({
            key: section,
            header: headerMap[section] || `## ${section}`,
            content: newContent.split('\n')
        })
    }
    
    // 4. 重组简历
    return sections.map(s => {
        const headerPart = s.header ? s.header + '\n' : ''
        const contentPart = s.content.join('\n').trim()
        return headerPart + contentPart
    }).join('\n\n').trim()
  }

  const [appliedCodeBlocks, setAppliedCodeBlocks] = useState<Record<string, boolean>>({})

  const applyPendingUpdate = (update: NonNullable<typeof pendingUpdate>) => {
    const baseContent = state.refinedContent || state.resumeText || ''
    const nextContent = update.type === 'update'
      ? updateResumeContent(baseContent, update.section, update.content)
      : update.fullContent
    const normalized = normalizeRefinedContent(nextContent)
    
    // Update global state
    setRefinedContent(normalized)
    setResumeText(normalized)
    
    navigateTo('dashboard')
    setActiveTab('refinement')
    // Always force to editor step
    setRefinementStep(1)
    setPreviewVersion(v => v + 1)
    return normalized
  }

  // 手动应用代码块修改
  const handleApplyCodeBlock = (code: string, blockId: string) => {
    // 移除可能的Markdown代码块标记
    const cleanCode = code.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim()
    const lines = cleanCode.split('\n')
    const firstLine = lines[0].trim()

    // 定义识别逻辑
    const getSectionFromLine = (line: string) => {
        const text = line.replace(/^#{1,6}\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/[:：]\s*$/, '').trim().toLowerCase()
        const map: Record<string, string> = {
            'summary': 'summary', 'professional summary': 'summary', '个人总结': 'summary', '自我评价': 'summary', '总结': 'summary',
            'experience': 'experience', 'work experience': 'experience', 'work history': 'experience', '工作经历': 'experience', '工作履历': 'experience', '职业经历': 'experience', '实习经历': 'experience',
            'projects': 'projects', 'project experience': 'projects', '项目经验': 'projects', '项目经历': 'projects',
            'skills': 'skills', 'technical skills': 'skills', 'core skills': 'skills', '核心技能': 'skills', '专业技能': 'skills', '专业能力': 'skills', '职业技能': 'skills', '技能清单': 'skills', '技术栈': 'skills',
            'education': 'education', '教育背景': 'education', '教育经历': 'education', '学历信息': 'education',
            'basic info': 'basicInfo', 'basic information': 'basicInfo', 'contact': 'basicInfo', '基本信息': 'basicInfo', '联系方式': 'basicInfo'
        }
        for (const [k, v] of Object.entries(map)) {
            if (text.includes(k)) return v
        }
        return ''
    }

    let section = getSectionFromLine(firstLine)
    let contentBody = cleanCode

    // 如果第一行是标题，移除它
    if (section) {
        contentBody = lines.slice(1).join('\n').trim()
    } else if (pendingUpdate?.type === 'update') {
        // 如果没识别出标题，但有 pendingUpdate，检查第一行是否看起来像个通用标题
        const potentialSection = getSectionFromLine(firstLine)
        if (potentialSection) {
            contentBody = lines.slice(1).join('\n').trim()
        }
        section = pendingUpdate.section
    }

    if (section) {
        const sectionLabelMap: Record<string, string> = {
          basicInfo: '基本信息',
          summary: '个人总结',
          experience: '工作经历',
          skills: '核心技能',
          education: '教育背景',
          projects: '项目经验'
        }
        const sectionLabel = sectionLabelMap[section] || section
        if (!window.confirm(`确认将修改应用到「${sectionLabel}」吗？`)) {
            return
        }
        
        applyPendingUpdate({ type: 'update', section, content: contentBody })
        
        // 更新状态以显示“已应用”
        setAppliedCodeBlocks(prev => ({ ...prev, [blockId]: true }))
        setPendingUpdate(null)
    } else {
        if (!window.confirm('未识别到章节标题，是否将该内容作为整份简历覆盖？')) {
            return
        }
        applyPendingUpdate({ type: 'rewrite', fullContent: cleanCode })
        setAppliedCodeBlocks(prev => ({ ...prev, [blockId]: true }))
        setPendingUpdate(null)
    }
  }

  const handleCopilotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!copilotInput.trim()) return

    const userMessage = {
      role: 'user' as const,
      content: copilotInput
    }

    const newMessages = [...(Array.isArray(copilotMessages) ? copilotMessages : []), userMessage]
    setCopilotMessages(newMessages)
    setCopilotInput('')
    setIsCopilotLoading(true)

    try {
      const normalizedInput = userMessage.content.replace(/\s/g, '')
      const cancelPattern = /(取消|不改|不用|不需要|不要|算了|否|不确认)/i
      const confirmPattern = /(确认|应用|同意|好的|可以|ok|没问题|确认修改|应用修改)/i
      if (pendingUpdate && (confirmPattern.test(normalizedInput) || cancelPattern.test(normalizedInput))) {
        if (!cancelPattern.test(normalizedInput) && confirmPattern.test(normalizedInput)) {
          applyPendingUpdate(pendingUpdate)
          setCopilotMessages([...newMessages, { role: 'assistant', content: '已应用修改。' }])
        } else {
          setCopilotMessages([...newMessages, { role: 'assistant', content: '已取消修改。' }])
        }
        setPendingUpdate(null)
        setIsCopilotLoading(false)
        return
      }
      if (pendingUpdate) {
        setPendingUpdate(null)
      }
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('请求超时')), 60000) // 60s timeout
      })

      const response = await Promise.race([
        fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: newMessages,
            temperature: 0.7,
            context: {
              resumeText: state.resumeText,
              refinedContent: state.refinedContent,
              diagnosticResult: state.diagnosticResult,
              strategyData: state.strategyData
            }
          })
        }),
        timeoutPromise
      ]) as Response

      if (!response.ok) {
        throw new Error('请求失败')
      }

      const data = await response.json()
      
      let content = data.content || ''
      const toolCalls = data.tool_calls
      let toolExecuted = false
      const sectionLabelMap: Record<string, string> = {
        basicInfo: '基本信息',
        summary: '个人总结',
        experience: '工作经历',
        skills: '核心技能',
        education: '教育背景',
        projects: '项目经验'
      }
      const sectionLabelToKey = Object.entries(sectionLabelMap).reduce<Record<string, string>>((acc, [key, label]) => {
        acc[label] = key
        return acc
      }, {})
      const sectionHeaderMap: Record<string, string> = {
        basicInfo: '## 基本信息',
        summary: '## 个人总结',
        experience: '## 工作经历',
        skills: '## 核心技能',
        education: '## 教育背景',
        projects: '## 项目经验'
      }
      const sectionMap: Record<string, string> = {
        'Summary': 'summary',
        'Professional Summary': 'summary',
        '个人总结': 'summary',
        '自我评价': 'summary',
        '总结': 'summary',
        'Experience': 'experience',
        'Work Experience': 'experience',
        'Project Experience': 'projects',
        '工作经历': 'experience',
        '项目经验': 'projects',
        '项目经历': 'projects',
        '实习经历': 'experience',
        'Skills': 'skills',
        'Technical Skills': 'skills',
        'Core Skills': 'skills',
        '核心技能': 'skills',
        '专业技能': 'skills',
        '技能清单': 'skills',
        'Education': 'education',
        '教育背景': 'education',
        '教育经历': 'education',
        'Basic Info': 'basicInfo',
        'Contact': 'basicInfo',
        '基本信息': 'basicInfo',
        '联系方式': 'basicInfo'
      }

      // Handle Tool Calls (Function Calling)
      if (toolCalls && Array.isArray(toolCalls)) {
        for (const toolCall of toolCalls) {
          if (toolCall.function.name === 'update_resume') {
             try {
               const args = JSON.parse(toolCall.function.arguments)
               console.log('Tool Call Triggered:', args)
               
               if (args.section && args.content) {
                  const sectionLabel = sectionLabelMap[args.section] || args.section
                  const header = sectionHeaderMap[args.section] || `## ${args.section}`
                  content = `修改预览（${sectionLabel}）：\n\n\`\`\`markdown\n${header}\n${String(args.content).trim()}\n\`\`\`\n\n是否确认修改？回复“确认”应用，回复“取消”放弃。`
                  setPendingUpdate({ type: 'update', section: args.section, content: String(args.content) })
                  toolExecuted = true
               }
             } catch (e) {
               console.error('Failed to execute tool call', e)
               content += `\n\n(自动更新失败: ${e instanceof Error ? e.message : '未知错误'}，请尝试手动修改)`
             }
          } else if (toolCall.function.name === 'rewrite_resume') {
             try {
               const args = JSON.parse(toolCall.function.arguments)
               console.log('Rewrite Tool Triggered:', args)

               if (args.full_content) {
                 content = `修改预览（整份简历）：\n\n\`\`\`markdown\n${String(args.full_content).trim()}\n\`\`\`\n\n是否确认修改？回复“确认”应用，回复“取消”放弃。`
                 setPendingUpdate({ type: 'rewrite', fullContent: String(args.full_content) })
                 toolExecuted = true
               }
             } catch (e) {
               console.error('Failed to execute rewrite tool', e)
               content += `\n\n(全篇重写失败: ${e instanceof Error ? e.message : '未知错误'})`
             }
          }
        }
      }

      // Legacy Protocol Fallback (keep just in case)
      const updateStart = ':::UPDATE_START:::'
      const updateEnd = ':::UPDATE_END:::'
      
      if (content.includes(updateStart) && content.includes(updateEnd)) {
        const startIndex = content.indexOf(updateStart)
        const endIndex = content.indexOf(updateEnd)
        let jsonStr = content.substring(startIndex + updateStart.length, endIndex).trim()
        
        // Robust cleanup for Markdown code blocks (```json ... ```)
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

        try {
              const updateData = JSON.parse(jsonStr)
              console.log('Update Triggered:', updateData)
              
              if (updateData.section && updateData.content) {
                const sectionLabel = sectionLabelMap[updateData.section] || updateData.section
                const header = sectionHeaderMap[updateData.section] || `## ${updateData.section}`
                content = `修改预览（${sectionLabel}）：\n\n\`\`\`markdown\n${header}\n${String(updateData.content).trim()}\n\`\`\`\n\n是否确认修改？回复“确认”应用，回复“取消”放弃。`
                setPendingUpdate({ type: 'update', section: updateData.section, content: String(updateData.content) })
                toolExecuted = true
              }
              
              // Clean content
              const before = content.substring(0, startIndex)
              const after = content.substring(endIndex + updateEnd.length)
              content = (before + after).trim()
          } catch (e) {
            console.error('Failed to parse update protocol', e)
            console.log('Raw JSON string:', jsonStr)
        }
      }
      
      if (!toolExecuted) {
        const codeBlockMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/)
        if (codeBlockMatch) {
          const blockContent = codeBlockMatch[1].trim()
          const headerMatch = blockContent.match(/^\s*(?:#{1,3}\s*)(.+?)(?:\r?\n|$)/)
          if (headerMatch) {
            const headerText = headerMatch[1].trim()
            let section = ''
            for (const [key, value] of Object.entries(sectionMap)) {
              if (headerText.toLowerCase().includes(key.toLowerCase())) {
                section = value
                break
              }
            }
            if (section) {
              const contentBody = blockContent.replace(/^\s*(?:#{1,3}\s*)(.+?)(?:\r?\n|$)/, '').trim()
              setPendingUpdate({ type: 'update', section, content: contentBody })
              if (!/是否确认修改/.test(content)) {
                content = `${content}\n\n是否确认修改？回复“确认”应用，回复“取消”放弃。`
              }
              toolExecuted = true
            }
          } else {
            const labelMatch = content.match(/修改预览（(.+?)）/)
            const labelSection = labelMatch ? sectionLabelToKey[labelMatch[1].trim()] : ''
            if (labelSection) {
              setPendingUpdate({ type: 'update', section: labelSection, content: blockContent })
            } else {
              setPendingUpdate({ type: 'rewrite', fullContent: blockContent })
            }
            if (!/是否确认修改/.test(content)) {
              content = `${content}\n\n是否确认修改？回复“确认”应用，回复“取消”放弃。`
            }
            toolExecuted = true
          }
        }
      }
      
      // Fallback if content is still empty
      if (!content.trim()) {
          content = toolExecuted ? "已完成更新。" : "抱歉，我没有理解您的指令，请重试。"
      }

      const assistantMessage = {
        role: 'assistant' as const,
        content: content
      }

      setCopilotMessages([...newMessages, assistantMessage])
    } catch (error) {
      console.error('Chat API error:', error)
      const errorMessage = {
        role: 'assistant' as const,
        content: `抱歉，遇到错误: ${error instanceof Error ? error.message : '未知错误'}。请稍后再试。`
      }
      setCopilotMessages([...newMessages, errorMessage])
    } finally {
      setIsCopilotLoading(false)
    }
  }

  // 面试提交处理
  const handleInterviewSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!state.inputMessage.trim() || state.isAnalyzing) return

    const userMessage = {
      role: 'user' as const,
      content: state.inputMessage
    }

    const newHistory = [...state.chatHistory, userMessage]
    setChatHistory(newHistory)
    setInputMessage('')
    setIsAnalyzing(true)

    try {
      const stageIndex = INTERVIEWER_PERSONAS.findIndex(p => p.id === state.interviewPersona)
      const response = await fetch('/api/interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage: stageIndex,
          role: INTERVIEWER_PERSONAS[stageIndex].role,
          jd: state.jobDescriptions[0] || '',
          resume: state.refinedContent || state.resumeText || '',
          history: newHistory
        })
      })

      if (!response.ok) {
        throw new Error('面试官思考失败，请稍后再试')
      }

      const data = await response.json()
      
      const assistantMessage = {
        role: 'assistant' as const,
        content: data.question,
        metadata: {
          isFollowUp: data.isFollowUp,
          internalNote: data.internalNote
        }
      }
      setChatHistory([...newHistory, assistantMessage])
    } catch (error) {
      console.error('Interview error:', error)
      const errorMessage = {
        role: 'assistant' as const,
        content: '抱歉，我刚才走神了，请再试一次。'
      }
      setChatHistory([...newHistory, errorMessage])
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleStartInterview = async () => {
    setInterviewStatus('active')
    setChatHistory([])
    setIsAnalyzing(true)

    try {
      const stageIndex = INTERVIEWER_PERSONAS.findIndex(p => p.id === state.interviewPersona)
      const persona = INTERVIEWER_PERSONAS[stageIndex]
      
      const response = await fetch('/api/interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage: stageIndex,
          role: persona.role,
          jd: state.jobDescriptions[0] || '',
          resume: state.refinedContent || state.resumeText || '',
          history: [{ 
            role: 'user', 
            content: `你好，我是候选人。请作为${persona.role}开始面试。请先介绍你自己，然后让我做一个简短的自我介绍。` 
          }]
        })
      })

      if (!response.ok) throw new Error('面试启动失败')

      const data = await response.json()
      setChatHistory([{
        role: 'assistant',
        content: data.question,
        metadata: {
          isFollowUp: data.isFollowUp,
          internalNote: data.internalNote
        }
      }])
    } catch (error) {
      console.error('Start interview error:', error)
      setChatHistory([{
        role: 'assistant',
        content: `你好，我是本次面试的 ${INTERVIEWER_PERSONAS.find(p => p.id === state.interviewPersona)?.role}。我们开始吧，请先做一个简短的自我介绍。`
      }])
    } finally {
      setIsAnalyzing(false)
    }
  }

  const renderReviewReportContent = (data: ReviewData | null | undefined) => (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Score & Summary Card */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
        <div className="relative flex flex-col md:flex-row items-center justify-between p-8 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-indigo-500/5">
          <div className="flex flex-col items-center md:items-start mb-6 md:mb-0">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">综合胜任力评分</h4>
            <div className="flex items-baseline gap-2">
              <div className="text-7xl font-serif font-black text-indigo-600 tracking-tighter">{data?.score ?? 0}</div>
              <div className="text-xl font-bold text-slate-300">/ 100</div>
            </div>
          </div>
          
          <div className="w-px h-16 bg-slate-100 hidden md:block"></div>

          <div className="flex-1 md:ml-10">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 text-center md:text-left">核心亮点</h4>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              {(data?.strengths || []).map((s) => (
                <span key={s} className="px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-100 shadow-sm flex items-center gap-2">
                  <IconCheck className="w-3.5 h-3.5" />
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Qualitative Analysis */}
      <section className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
          <h4 className="text-2xl font-serif font-bold text-slate-900">深度定性分析</h4>
        </div>
        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-lg">
          <ReactMarkdown>{data?.detailedFeedback || '暂无详细分析'}</ReactMarkdown>
        </div>
      </section>

      {/* Questions Analysis & Reference Answers */}
      <section className="space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
          <h4 className="text-2xl font-serif font-bold text-slate-900">问答详情与参考回答</h4>
        </div>
        
        {(data?.questionsAnalysis || []).map((item, idx) => (
          <div key={idx} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="p-8 border-b border-slate-50">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">
                  Q{idx + 1}
                </div>
                <p className="text-lg font-bold text-slate-900 leading-relaxed">
                  {item.question}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-8 bg-slate-50/50 border-r border-slate-50">
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                  你的回答
                </h5>
                <p className={`text-sm leading-relaxed ${item.userAnswer === '未回答' ? 'text-slate-400 italic' : 'text-slate-600'}`}>
                  {item.userAnswer}
                </p>
              </div>
              
              <div className="p-8 bg-indigo-50/30">
                <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                  AI 参考回答
                </h5>
                <div className="text-sm text-indigo-900 leading-relaxed prose prose-indigo prose-sm max-w-none">
                  <ReactMarkdown>{item.referenceAnswer}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Improvement Suggestions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-2 h-8 bg-red-400 rounded-full"></div>
            <h4 className="text-2xl font-serif font-bold text-slate-900">待提升项</h4>
          </div>
          <div className="space-y-4">
            {(data?.weaknesses || []).map((w: string) => (
              <div key={w} className="p-4 bg-red-50/50 rounded-2xl border border-red-100 flex items-start gap-3">
                <IconAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700 font-medium">{w}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-2 h-8 bg-green-400 rounded-full"></div>
            <h4 className="text-2xl font-serif font-bold text-slate-900">行动建议</h4>
          </div>
          <div className="p-6 bg-green-50/50 rounded-2xl border border-green-100 italic text-slate-700 leading-relaxed">
            &quot;{data?.suggestions || '暂无建议'}&quot;
          </div>
        </section>
      </div>
    </div>
  )

  // Robust JSON parsing and sanitization (Moved from backend for streaming support)
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

  const parseJSONRobust = (str: string) => {
    try {
      return JSON.parse(str)
    } catch (e) {
      const cleanStr = str.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
      try {
        return JSON.parse(cleanStr)
      } catch (e2) {
        const firstBrace = str.indexOf('{')
        const lastBrace = str.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1) {
          const subStr = str.substring(firstBrace, lastBrace + 1)
          try {
             return JSON.parse(subStr)
          } catch (e3) {
             let fixedStr = subStr.replace(/,(\s*[}\]])/g, '$1')
             try {
               return JSON.parse(fixedStr)
             } catch (e4) {
               try {
                 const escaped = fixedStr.replace(/\n/g, '\\n').replace(/\r/g, '')
                 return JSON.parse(escaped)
               } catch (e5) {
                 try {
                   const flattened = fixedStr.replace(/[\r\n]/g, ' ')
                   return JSON.parse(flattened)
                 } catch (e6) {
                   throw e
                 }
               }
             }
          }
        }
        throw e
      }
    }
  }

  const handleEndInterview = async () => {
    if (!confirm('确定要结束本次面试并查看复盘报告吗？')) return
    
    setIsAnalyzing(true)
    setInterviewStatus('review')
    
    try {
      const stageIndex = INTERVIEWER_PERSONAS.findIndex(p => p.id === state.interviewPersona)
      const response = await fetch('/api/interview/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: INTERVIEWER_PERSONAS[stageIndex].role,
          jd: state.jobDescriptions[0] || '',
          resume: state.refinedContent || state.resumeText || '',
          history: state.chatHistory
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || '复盘报告生成失败')
      }

      // Streaming response handling
      if (!response.body) throw new Error('ReadableStream not supported')
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let result = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        result += decoder.decode(value, { stream: true })
      }

      // Parse and sanitize the accumulated JSON
      const parsedData = parseJSONRobust(result)
      const data = sanitizeReviewData(parsedData)
      
      setReviewData(data)

      // 保存到历史记录
      addInterviewHistory({
        id: Date.now().toString(),
        date: new Date().toLocaleString(),
        persona: INTERVIEWER_PERSONAS[stageIndex].role,
        reviewData: data,
        chatHistory: state.chatHistory
      })
    } catch (error) {
      console.error('End interview error:', error)
      alert(`生成复盘报告失败: ${error instanceof Error ? error.message : '请稍后再试'}`)
      setInterviewStatus('active') // 回到面试状态，允许重试
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 渲染 Hero 视图
  const renderHeroView = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center animate-fade-in relative bg-slate-50 overflow-hidden">
      {/* Abstract Professional Background */}
      <div className="absolute inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-0 left-0 w-full h-full bg-white"></div>
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-50/50 blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-slate-100/50 blur-[120px]"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-12">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm mb-4">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span className="text-xs font-medium text-slate-600 tracking-wide uppercase">AI Career Intelligence</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-serif text-slate-900 tracking-tight leading-[1.1]">
            构建未来，<br />
            <span className="text-indigo-700 italic">无限可能</span>
          </h1>

          <p className="text-xl text-slate-600 font-light max-w-2xl mx-auto leading-relaxed text-balance">
            全栈 AI 备战平台，提供深度简历诊断、智能精修与实战模拟面试，助你从容应对每一次职业挑战。
          </p>
        </div>

        <div className="pt-4">
          <button
            onClick={() => navigateTo('dashboard')}
            className="hero-button group relative px-10 py-5 bg-slate-900 text-white text-lg font-medium rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-3">
              启动职场智能体
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </span>
            <div className="absolute inset-0 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          </button>
        </div>
      </div>

      <div className="absolute bottom-10 w-full text-center">
        <p className="text-xs font-medium text-slate-400 tracking-widest uppercase">
          Powered by DeepSeek V3 · Designed for Excellence
        </p>
      </div>
    </div>
  )

  // 渲染 API Key 模态框
  // 渲染主仪表板
  const renderDashboard = () => (
    <div className="bg-white p-6 min-h-screen">
      {/* 顶部导航 */}
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">AI CAREER AGENT</span>
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-4xl font-serif font-bold text-slate-900">智感生涯</h1>
              <span className="text-2xl text-slate-200 font-light mx-1">/</span>
              <h1 className="text-4xl font-serif font-bold text-slate-900">Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (confirm('确定要重置所有数据并重新开始吗？这将清除所有简历、职位描述和面试历史。')) {
                  clearAllData()
                }
              }}
              className="text-xs font-bold text-red-400 hover:text-red-600 transition-colors uppercase tracking-widest px-3 py-1.5 border border-red-100 hover:border-red-200 rounded-lg bg-red-50/30"
            >
              重置系统
            </button>
            <button
              onClick={() => {
                navigateTo('hero')
              }}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      {/* 主要内容区 */}
      <main className="max-w-7xl mx-auto">
        {/* Tab 导航 */}
        <div className="flex gap-1 mb-8 bg-slate-100 p-1 rounded-xl">
          {([
            { id: 'diagnostic', label: '深度诊断' },
            { id: 'refinement', label: '简历重铸' },
            { id: 'interview', label: '模拟面试' }
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-6 rounded-lg text-sm transition-all ${
                state.activeTab === tab.id
                  ? 'bg-[#6366f1] text-white font-bold shadow-lg shadow-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 深度诊断模块 */}
        {state.activeTab === 'diagnostic' && renderDiagnostic()}
        {/* 简历精炼模块 */}
        {state.activeTab === 'refinement' && renderRefinement()}
        {/* 模拟面试模块 */}
        {state.activeTab === 'interview' && renderInterview()}
      </main>

      {/* 底部悬浮 AI Copilot 按钮 */}
      <button
          onMouseDown={(e) => handleMouseDown(e, 'button')}
          onClick={() => {
            if (!hasMovedRef.current) {
              toggleCopilot()
            }
          }}
          className="copilot-toggle-button fixed bottom-8 right-8 w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform z-50 group cursor-move"
      >
          <div className="relative">
              <IconMessageSquare className="w-6 h-6 text-white" />
              <div className="absolute -top-3 -right-3 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white">
                  Ai
              </div>
          </div>
      </button>

      {/* AI Copilot 浮动窗口 */}
      {isCopilotOpen && renderCopilot()}

      {/* 历史面试记录弹窗 */}
      {showHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              setShowHistory(false)
              setSelectedHistory(null)
            }}
          ></div>
          <div className="relative w-full max-w-5xl h-[80vh] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-scale-up">
            {/* 弹窗头部 */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <IconFileText className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-serif font-bold text-slate-900">历史面试记录</h3>
                  <p className="text-slate-500 text-sm">回顾过去的面试表现与 AI 建议</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowHistory(false)
                  setSelectedHistory(null)
                }}
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <IconX className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* 左侧列表 */}
              <div className="w-80 border-r border-slate-100 overflow-y-auto custom-scrollbar bg-slate-50/30">
                {state.interviewHistory && state.interviewHistory.length > 0 ? (
                  <div className="p-4 space-y-3">
                    {state.interviewHistory.map((item: InterviewHistoryRecord) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedHistory(item)}
                        className={`w-full p-4 rounded-2xl text-left transition-all border ${
                          selectedHistory?.id === item.id
                            ? 'bg-white border-indigo-200 shadow-md shadow-indigo-500/5'
                            : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider px-2 py-0.5 bg-indigo-50 rounded-md">
                            {item.persona.split(' ')[0]}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.date.split(' ')[0]}</span>
                        </div>
                        <div className="font-bold text-slate-900 text-sm truncate mb-1">
                          {item.persona}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-slate-400">评分: <span className="text-indigo-600 font-bold">{item.reviewData.score}</span></div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('确定要删除这条记录吗？')) {
                                deleteInterviewHistory(item.id)
                                if (selectedHistory?.id === item.id) setSelectedHistory(null)
                              }
                            }}
                            className="p-1 hover:text-red-500 text-slate-300 transition-colors"
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                      <IconFileText className="w-8 h-8" />
                    </div>
                    <p className="text-slate-400 text-sm">暂无面试记录</p>
                  </div>
                )}
              </div>

              {/* 右侧详情 */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/10">
                {selectedHistory ? (
                  <div className="p-8">
                    <div className="mb-8 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">面试时间: {selectedHistory.date}</div>
                        <h4 className="text-3xl font-serif font-bold text-slate-900">{selectedHistory.persona} 面试报告</h4>
                      </div>
                    </div>
                    {renderReviewReportContent(selectedHistory.reviewData)}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12">
                    <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mb-6 text-indigo-200">
                      <IconFileText className="w-12 h-12" />
                    </div>
                    <h4 className="text-xl font-serif font-bold text-slate-900 mb-2">选择一份记录查看详情</h4>
                    <p className="text-slate-500 max-w-xs">点击左侧列表中的面试记录，即可查看完整的 AI 复盘报告和改进建议。</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // 运行简历精炼
  const handleRefineResume = async () => {
    if (!state.resumeText || !state.jobDescriptions[0]) {
      alert('请先上传简历并提供目标JD')
      return
    }

    if (state.strategyData.strengths.length === 0 && !state.strategyData.newAchievements) {
      if (!confirm('您未选择任何优势标签或填写新成就，确认直接开始精炼吗？')) {
        return
      }
    }

    setIsAnalyzing(true)
    setLoadingType('refinement')

    try {
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume: state.resumeText,
          jds: state.jobDescriptions.filter(jd => jd.trim()),
          strengths: state.strategyData.strengths,
          newAchievements: state.strategyData.newAchievements
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '精炼请求失败')
      }

      const data = await response.json()
      const normalizedContent = normalizeRefinedContent(data.content)
      setRefinedContent(normalizedContent)
      setResumeText(normalizedContent)
      setRefinementStep(1)
      setPreviewVersion(v => v + 1)
    } catch (error) {
      console.error('Refinement error:', error)
      alert('简历精炼失败：' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setIsAnalyzing(false)
      setLoadingType('diagnostic') // Reset default
    }
  }

  // 渲染精炼模块
  const renderRefinement = () => {
    // 动态获取 AI 挖掘的优势
    const aiStrengths = state.diagnosticResult?.deep_diagnostic?.flash_points || []
    const defaultStrengths = ['技术能力', '项目经验', '沟通能力', '学习能力']
    // 如果没有 AI 结果且没有自定义，使用默认；否则合并 AI 和自定义
    const availableStrengths = aiStrengths.length > 0 
      ? Array.from(new Set([...aiStrengths, ...customStrengths]))
      : Array.from(new Set([...defaultStrengths, ...customStrengths]))

    const handleAddStrength = () => {
      if (newStrengthInput.trim()) {
        const newStrength = newStrengthInput.trim()
        if (!availableStrengths.includes(newStrength)) {
            setCustomStrengths([...customStrengths, newStrength])
            // 自动选中新添加的标签
            setStrategyData({
                ...state.strategyData,
                strengths: [...state.strategyData.strengths, newStrength]
            })
        }
        setNewStrengthInput('')
      }
    }

    const refinedDisplayContent = state.refinementStep === 1
      ? (state.refinedContent || '')
      : (state.refinedContent || state.resumeText || '')

    // Step 0: Configuration
    if (state.refinementStep === 0) {
      return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 左侧：核心优势确认 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 flex flex-col h-[500px]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                  <IconCheck className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-serif font-bold text-slate-900">核心优势确认</h3>
              </div>
              <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                AI 已从你的诊断报告中提取以下关键词，请确认或补充。这些优势将被强化到简历的 Summary 和 Skills 模块。
              </p>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-4 space-y-2">
                 {availableStrengths.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
                      暂无自动提取的标签，请手动添加
                    </div>
                 ) : (
                    availableStrengths.map((skill, index) => (
                    <label key={index} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${
                        state.strategyData.strengths.includes(skill)
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                        : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm'
                    }`}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          state.strategyData.strengths.includes(skill)
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'bg-white border-slate-300 group-hover:border-indigo-400'
                      }`}>
                          {state.strategyData.strengths.includes(skill) && <IconCheck className="w-3 h-3 text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={state.strategyData.strengths.includes(skill)}
                        onChange={(e) => {
                          const newStrengths = e.target.checked
                            ? [...state.strategyData.strengths, skill]
                            : state.strategyData.strengths.filter(s => s !== skill)
                          setStrategyData({ ...state.strategyData, strengths: newStrengths })
                        }}
                      />
                      <span className={`text-sm font-medium ${state.strategyData.strengths.includes(skill) ? 'text-indigo-900' : 'text-slate-700'}`}>{skill}</span>
                      {aiStrengths.includes(skill) && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full ml-auto font-medium">AI推荐</span>
                      )}
                    </label>
                  ))
                 )}
              </div>

              <div className="relative">
                <input
                    type="text"
                    value={newStrengthInput}
                    onChange={(e) => setNewStrengthInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddStrength()
                        }
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400 pr-12"
                    placeholder="输入其他核心优势 (按回车添加) ..."
                />
                <button 
                    onClick={handleAddStrength}
                    disabled={!newStrengthInput.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50 transition-colors"
                >
                    <IconCheck className="w-4 h-4" />
                </button>
              </div>
            </section>

            {/* 右侧：新学成果注入 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 flex flex-col h-[500px]">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                        <IconFileText className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-serif font-bold text-slate-900">新学成果注入</h3>
                </div>
                <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                    这段时间你学习了什么新技术？完成了什么新项目？AI 将基于 STAR 原则把这些成果自然融入你的项目经历中。
                </p>
                <textarea
                  className="flex-1 w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder-slate-400 leading-relaxed"
                  placeholder={`例如：我最近自学了 Next.js 14，并独立开发了一个全栈博客项目，部署到了 Vercel。在这个过程中，我深入理解了 Server Components 和 Server Actions，并实践了 ISR 增量静态再生策略，显著提升了页面加载速度...`}
                  value={state.strategyData.newAchievements}
                  onChange={(e) => setStrategyData({ ...state.strategyData, newAchievements: e.target.value })}
                />
            </section>
          </div>

          <div className="flex justify-center pb-8">
            <button
                onClick={handleRefineResume}
                disabled={state.isAnalyzing}
                className="group relative px-8 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-3 overflow-hidden"
            >
                {state.isAnalyzing && loadingType === 'refinement' ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="animate-pulse">{loadingText}</span>
                    </>
                ) : (
                    <>
                        <span>生成精修简历</span>
                        <IconChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                )}
            </button>
          </div>
        </div>
      )
    }

    // Step 1: Editor & Preview
    return (
      <div className="h-[calc(100vh-140px)] grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in pb-6">
        {/* 左侧：Smart Editor */}
        <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="font-semibold text-slate-700 text-sm">智能编辑器 (Markdown)</span>
                </div>
                <button 
                    onClick={() => setRefinementStep(0)}
                    className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                >
                    <span>← 返回设置</span>
                </button>
            </div>
            <textarea
                className="flex-1 p-6 w-full resize-none focus:outline-none font-mono text-sm text-slate-800 bg-white leading-relaxed custom-scrollbar"
                value={refinedDisplayContent}
                onChange={(e) => {
                  const nextValue = e.target.value
                  setRefinedContent(nextValue)
                  setResumeText(nextValue)
                  setPreviewVersion(v => v + 1)
                }}
                spellCheck={false}
            />
        </div>

        {/* 右侧：预览 */}
        <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <span className="font-semibold text-slate-700 text-sm">实时预览</span>
                <div className="flex gap-2">
                    {/* 这里可以加下载按钮等 */}
                </div>
            </div>
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white">
                <div className="prose prose-sm max-w-none prose-slate prose-headings:font-serif prose-headings:font-bold prose-h1:text-3xl prose-h2:text-xl prose-h2:border-b prose-h2:pb-2 prose-h2:mt-8 prose-li:my-1">
                    <ReactMarkdown key={previewVersion}>{refinedDisplayContent}</ReactMarkdown>
                </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
                <span className="text-xs text-slate-500 font-medium">预览您的精修简历</span>
                <div className="flex gap-3">
                    <button 
                        onClick={handleRefineResume}
                        className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors uppercase tracking-wide"
                    >
                        重新生成
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTab('interview')
                            // 可以在这里自动设置面试上下文
                        }}
                        className="px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 uppercase tracking-wide"
                    >
                        模拟面试 <IconChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
      </div>
    )
  }

  // 渲染面试模块
  const renderInterview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      {/* 左侧：角色选择 */}
      <div className="lg:col-span-4 space-y-6">
        <section className="glass-card rounded-2xl p-6">
          <div className="mb-6">
            <span className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">选择面试官</span>
            <h3 className="text-xl font-serif font-bold text-slate-900 mt-1">面试官设定</h3>
          </div>
          <div className="space-y-3">
            {INTERVIEWER_PERSONAS.map((persona) => (
              <button
                key={persona.id}
                onClick={() => {
                  if (state.interviewStatus === 'setup') {
                    setInterviewPersona(persona.id as InterviewPersonaId)
                  }
                }}
                disabled={state.interviewStatus !== 'setup'}
                className={`w-full p-4 text-left rounded-xl transition-all border-2 ${
                  state.interviewPersona === persona.id
                    ? 'bg-slate-900 border-slate-900 shadow-lg'
                    : 'bg-white border-slate-100 hover:border-slate-200'
                } ${state.interviewStatus !== 'setup' ? 'opacity-80 cursor-not-allowed' : ''}`}
              >
                <div className={`font-bold ${state.interviewPersona === persona.id ? 'text-white' : 'text-slate-900'}`}>
                  {persona.role}
                </div>
                <div className={`text-xs mt-1 ${state.interviewPersona === persona.id ? 'text-slate-300' : 'text-slate-500'}`}>
                  {persona.id === 'TA' && '人力资源部'}
                  {persona.id === 'HM' && '业务部门'}
                  {persona.id === 'Director' && '高管层'}
                </div>
                <div className="flex gap-1 mt-3">
                  {persona.id === 'TA' && [
                    { en: 'Efficient', zh: '高效' },
                    { en: 'Standardized', zh: '标准化' },
                    { en: 'Screening', zh: '初筛' }
                  ].map(tag => (
                    <span key={tag.en} className={`text-[9px] px-2 py-0.5 rounded-full ${state.interviewPersona === persona.id ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-500'}`}>
                      {tag.zh}
                    </span>
                  ))}
                  {persona.id === 'HM' && [
                    { en: 'Pragmatic', zh: '务实' },
                    { en: 'Detail-oriented', zh: '注重细节' },
                    { en: 'STAR Method', zh: 'STAR 法则' }
                  ].map(tag => (
                    <span key={tag.en} className={`text-[9px] px-2 py-0.5 rounded-full ${state.interviewPersona === persona.id ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-500'}`}>
                      {tag.zh}
                    </span>
                  ))}
                  {persona.id === 'Director' && [
                    { en: 'Strategic', zh: '战略性' },
                    { en: 'Visionary', zh: '远见性' },
                    { en: 'Potential', zh: '潜力评估' }
                  ].map(tag => (
                    <span key={tag.en} className={`text-[9px] px-2 py-0.5 rounded-full ${state.interviewPersona === persona.id ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-500'}`}>
                      {tag.zh}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 历史记录按钮 */}
        <button
          onClick={() => setShowHistory(true)}
          className="w-full p-4 flex items-center justify-between glass-card rounded-2xl hover:border-indigo-200 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <IconFileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-900">历史面试记录</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Historical Records</div>
            </div>
          </div>
          <IconChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* 右侧：面试界面 */}
      <div className="lg:col-span-8">
        {state.interviewStatus === 'setup' && (
          <section className="bg-white rounded-3xl shadow-xl border border-slate-100 p-12 h-[650px] flex flex-col items-center justify-center text-center relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50"></div>

            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-10 shadow-lg shadow-indigo-200 rotate-3 mx-auto">
                <IconMessageSquare className="w-10 h-10 text-white -rotate-3" />
              </div>
              
              <div className="space-y-4 mb-12">
                <h2 className="text-4xl font-serif font-bold text-slate-900">准备好开始模拟面试了吗？</h2>
                <p className="text-slate-500 max-w-md mx-auto leading-relaxed text-lg">
                  您即将与 <span className="font-bold text-indigo-600">{INTERVIEWER_PERSONAS.find(p => p.id === state.interviewPersona)?.role}</span> 进行深度对话。
                  我们将基于您的简历和目标职位，为您提供最真实的面试体验。
                </p>
              </div>

              <div className="flex flex-col items-center gap-6">
                <button
                  onClick={handleStartInterview}
                  className="group relative px-16 py-5 bg-slate-900 text-white rounded-2xl font-bold text-xl shadow-2xl hover:shadow-indigo-200 hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center gap-4 overflow-hidden"
                >
                  <span className="relative z-10">开始面试</span>
                  <IconChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform relative z-10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
                
                <div className="flex items-center gap-8 text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <span className="text-xs font-medium uppercase tracking-widest">实时分析</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                    <span className="text-xs font-medium uppercase tracking-widest">专家反馈</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {state.interviewStatus === 'active' && (
          <section className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[700px]">
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600 border-2 border-white shadow-sm">
                    {state.interviewPersona === 'TA' ? 'HR' : state.interviewPersona === 'HM' ? 'HM' : 'DIR'}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 leading-none mb-1">
                    {INTERVIEWER_PERSONAS.find(p => p.id === state.interviewPersona)?.role}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {state.isAnalyzing ? '正在输入...' : '正在聆听'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleEndInterview}
                className="px-5 py-2.5 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-red-100"
              >
                <IconX className="w-4 h-4" />
                <span>结束面试</span>
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/20 custom-scrollbar" id="interview-chat">
              {state.chatHistory.map((message, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                      {message.role === 'assistant' ? `${INTERVIEWER_PERSONAS.find(p => p.id === state.interviewPersona)?.role}` : '候选人 (您)'}
                    </span>
                  </div>
                  <div
                    className={`max-w-[80%] p-5 rounded-2xl shadow-sm text-[15px] leading-relaxed ${
                      message.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'
                    }`}
                  >
                    <div className={`prose prose-sm max-w-none ${message.role === 'user' ? 'prose-invert' : 'prose-slate'}`}>
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {state.isAnalyzing && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                      {INTERVIEWER_PERSONAS.find(p => p.id === state.interviewPersona)?.role}
                    </span>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                    <span className="text-xs font-medium text-slate-400 italic">面试官正在思考...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="p-6 bg-white border-t border-slate-100">
              <form onSubmit={handleInterviewSubmit} className="relative group">
                <textarea
                  value={state.inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleInterviewSubmit()
                    }
                  }}
                  placeholder="请输入您的回答..."
                  className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl text-[15px] focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 transition-all resize-none h-24 pr-16 custom-scrollbar"
                  disabled={state.isAnalyzing}
                />
                <button
                  type="submit"
                  disabled={!state.inputMessage.trim() || state.isAnalyzing}
                  className="absolute right-4 bottom-4 p-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-20 disabled:grayscale shadow-xl shadow-indigo-100 active:scale-95 z-10"
                >
                  <IconSend className="w-5 h-5" />
                </button>
              </form>
              <div className="flex justify-between items-center mt-3 px-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Shift + Enter 换行</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">由 AI Career Agent 提供支持</span>
              </div>
            </div>
          </section>
        )}

        {state.interviewStatus === 'review' && (
          <section className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[700px] animate-fade-in">
             <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                  <IconFileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 leading-none mb-1">面试复盘报告</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">面试表现分析报告</p>
                </div>
              </div>
              <button
                onClick={() => setInterviewStatus('setup')}
                className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all flex items-center gap-2"
              >
                <IconRefresh className="w-4 h-4" />
                <span>重新开始</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/10">
              {state.isAnalyzing ? (
                <div className="h-full flex flex-col items-center justify-center space-y-6 text-center">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-indigo-600 font-bold text-xs animate-pulse">AI</div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-900 font-bold text-xl">正在深度分析您的面试表现...</p>
                    <p className="text-slate-500 max-w-xs mx-auto">我们将基于胜任力、表达逻辑、应变能力等维度为您生成详尽的复盘报告。</p>
                  </div>
                </div>
              ) : (
                renderReviewReportContent(state.reviewData)
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )

  // 渲染深度诊断模块
  const renderDiagnostic = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      {/* 左侧：输入区域 */}
      <div className="lg:col-span-5 space-y-6">
        <section className="glass-card rounded-2xl p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-serif font-bold text-slate-900">目标职位 (JD)</h3>
            <button
              onClick={() => setJobDescriptions([...state.jobDescriptions, ''])}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-widest"
            >
              + 添加职位 ({state.jobDescriptions.length}/10)
            </button>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {state.jobDescriptions.map((jd, idx) => (
              <textarea
                key={idx}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder-slate-400 font-mono resize-none"
                rows={5}
                placeholder={`粘贴第 ${idx + 1} 个职位的描述 (JD)...`}
                value={jd}
                onChange={(e) => handleJdChange(idx, e.target.value)}
              />
            ))}
          </div>
        </section>

        <section className="glass-card rounded-2xl p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-serif font-bold text-slate-900">当前简历</h3>
            <div className="relative">
              <input
                type="file"
                id="resume-upload"
                className="hidden"
                accept=".pdf,.txt"
                onChange={handleFileUpload}
                disabled={isParsing}
              />
              <label
                htmlFor="resume-upload"
                className={`flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors uppercase tracking-widest border border-transparent hover:border-indigo-100 ${
                  isParsing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isParsing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    解析中...
                  </>
                ) : (
                  <>
                    <IconUpload /> 上传 PDF
                  </>
                )}
              </label>
            </div>
          </div>
          <textarea
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-[300px] resize-none placeholder-slate-400 font-mono"
            placeholder="或者直接在此粘贴简历文本..."
            value={state.resumeText}
            onChange={(e) => setResumeText(e.target.value)}
          />
        </section>

        {/* 备战时间设置 */}
        <section className="glass-card rounded-2xl p-6 md:p-8">
          <h3 className="text-xl font-serif font-bold text-slate-900 mb-6">备战设置</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-700">距离面试天数</span>
                <span className="font-bold text-indigo-600">{prepDays} 天</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={prepDays}
                onChange={(e) => setPrepDays(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-700">每日复习时长</span>
                <span className="font-bold text-indigo-600">{dailyHours} 小时</span>
              </div>
              <input
                type="range"
                min="1"
                max="12"
                value={dailyHours}
                onChange={(e) => setDailyHours(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </section>

        <button
          onClick={runDiagnostic}
          disabled={state.isAnalyzing}
          className="w-full py-5 btn-primary rounded-xl font-bold text-lg shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.isAnalyzing ? (
            <div className="flex flex-col items-center gap-2">
              <div className="loader border-white border-t-transparent"></div>
              <span className="text-xs font-normal opacity-90 animate-pulse">{loadingText}</span>
            </div>
          ) : (
            <>
              <IconRefresh /> 启动 OEP 全维诊断
            </>
          )}
        </button>
      </div>

      {/* 右侧：结果区域 */}
      <div className="lg:col-span-7 space-y-6">
        {state.diagnosticResult && typeof state.diagnosticResult.summary === 'object' ? (
          <div className="space-y-6">
            {/* 总体评分 */}
            <section className="glass-card rounded-2xl p-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-serif font-bold text-slate-900">诊断总览</h3>
                  <div className="text-sm text-indigo-600 font-medium mt-1">{state.diagnosticResult.summary?.career_persona}</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-indigo-600">{state.diagnosticResult.summary?.total_score}</div>
                  <div className="text-sm text-slate-600">总分</div>
                </div>
              </div>
              <p className="text-slate-700 mb-6">{state.diagnosticResult.summary?.short_feedback}</p>
              
              {/* 雷达图 */}
              {state.diagnosticResult.radar_data && (
                <div className="mt-8 border-t border-slate-100 pt-8">
                  <h4 className="font-semibold text-slate-800 mb-4">能力维度分析</h4>
                  <RadarChart data={state.diagnosticResult.radar_data} />
                </div>
              )}
            </section>

            {/* 深度诊断 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="glass-card rounded-2xl p-6">
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <IconAlert className="w-4 h-4 text-red-600" />
                  面试官顾虑
                </h4>
                <ul className="space-y-2">
                  {state.diagnosticResult.deep_diagnostic?.interviewer_fears?.map((fear: string, index: number) => (
                    <li key={index} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0"></span>
                      {fear}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="glass-card rounded-2xl p-6">
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <IconCheck className="w-4 h-4 text-indigo-600" />
                  隐形金子
                </h4>
                <ul className="space-y-2">
                  {state.diagnosticResult.deep_diagnostic?.hidden_gems?.map((gem: string, index: number) => (
                    <li key={index} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></span>
                      {gem}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* 技能矩阵 */}
            <section className="glass-card rounded-2xl p-8">
              <h3 className="text-xl font-serif font-bold text-slate-900 mb-6">技能矩阵</h3>
              
              <div className="mb-6">
                <h4 className="font-semibold text-slate-800 mb-2">硬技能</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-xs font-bold text-green-700 uppercase mb-1">已匹配</div>
                    <div className="flex flex-wrap gap-2">
                      {state.diagnosticResult.skills_matrix?.hard_skills?.matched?.map((skill: string, idx: number) => (
                        <span key={idx} className="text-xs bg-white px-2 py-1 rounded border border-green-200 text-green-800">{skill}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-xs font-bold text-red-700 uppercase mb-1">缺口</div>
                    <div className="flex flex-wrap gap-2">
                      {state.diagnosticResult.skills_matrix?.hard_skills?.gaps?.map((skill: string, idx: number) => (
                        <span key={idx} className="text-xs bg-white px-2 py-1 rounded border border-red-200 text-red-800">{skill}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 italic">{state.diagnosticResult.skills_matrix?.hard_skills?.comment}</p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 mb-2">可迁移能力</h4>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <div className="flex gap-2 mb-2">
                    <span className="font-bold text-indigo-700">支点:</span>
                    <span className="text-slate-700">{state.diagnosticResult.skills_matrix?.transferable_power?.lever_found}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold text-indigo-700">影响力:</span>
                    <span className="text-slate-700">{state.diagnosticResult.skills_matrix?.transferable_power?.impact}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 优化建议 */}
            <section className="glass-card rounded-2xl p-8">
              <h3 className="text-xl font-serif font-bold text-slate-900 mb-6">简历优化建议</h3>
              <div className="space-y-4">
                {(Array.isArray(state.diagnosticResult?.optimization_tips)
                  ? (state.diagnosticResult.optimization_tips as OptimizationTip[])
                  : []
                ).map((tip, index) => (
                  <div key={index} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-xs font-bold text-red-500 mb-1">BEFORE</div>
                        <div className="text-sm text-slate-500 line-through">{tip.original_text}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-green-500 mb-1">AFTER</div>
                        <div className="text-sm text-slate-800 font-medium">{tip.suggested_text}</div>
                      </div>
                    </div>
                    <div className="text-xs text-indigo-600 bg-indigo-50 p-2 rounded">
                      <strong>WHY:</strong> {tip.why}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 学习计划 */}
            <section className="glass-card rounded-2xl p-8">
              <h3 className="text-xl font-serif font-bold text-slate-900 mb-6">学习策略 & 面试防御</h3>
              
              <div className="mb-6">
                <div className="inline-block bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
                  {state.diagnosticResult.learning_strategy?.type}
                </div>
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg mb-4">
                  <div className="font-bold text-amber-800 mb-1">最高优先级 (24h)</div>
                  <p className="text-amber-900 text-sm">{state.diagnosticResult.learning_strategy?.priority_zero}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-slate-800 mb-3">作战计划 (Timeline)</h4>
                  <div className="space-y-0">
                    {(() => {
                      const timeline = state.diagnosticResult?.learning_strategy?.timeline
                      if (Array.isArray(timeline)) {
                        return (timeline as LearningTimelineItem[]).map((item, index, array) => (
                          <div key={index} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 mt-1.5 shadow-sm ring-2 ring-indigo-50"></div>
                              {index !== array.length - 1 && (
                                <div className="w-0.5 flex-1 bg-indigo-100 my-1 rounded-full"></div>
                              )}
                            </div>
                            <div className="flex-1 pb-6">
                              <div className="font-bold text-indigo-900 text-sm mb-1.5">{item.stage}</div>
                              <div className="text-slate-700 text-sm bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                {item.task}
                              </div>
                            </div>
                          </div>
                        ))
                      }
                      return (
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                          {typeof timeline === 'string' ? (
                            timeline.split('\n').filter(Boolean).map((line: string, i: number) => (
                              <p key={i} className="text-slate-700 text-sm leading-relaxed">{line}</p>
                            ))
                          ) : (
                            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                              {(() => {
                                if (timeline && typeof timeline === 'object' && !Array.isArray(timeline) && 'plan' in timeline) {
                                  const planValue = (timeline as { plan?: string }).plan
                                  return planValue || '暂无计划'
                                }
                                return '暂无计划'
                              })()}
                            </p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-3">面试防御话术</h4>
                  <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 leading-relaxed italic border-l-4 border-indigo-200">
                    &quot;{state.diagnosticResult.learning_strategy?.interview_defense}&quot;
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <section className="glass-card rounded-2xl p-8">
              <h3 className="text-xl font-serif font-bold text-slate-900 mb-6">
                {state.diagnosticResult ? "诊断数据版本过旧，请重新运行" : "等待诊断结果..."}
              </h3>
              <p className="text-slate-600">请在左侧输入职位描述和简历，然后点击&quot;启动 OEP 全维诊断&quot;按钮。</p>
            </section>
          </div>
        )}
      </div>
    </div>
  )

  // 渲染 AI Copilot
  const renderCopilot = () => (
    <div
      className="copilot-container fixed w-[380px] h-[580px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-40"
      style={{ bottom: '8rem', right: '2rem' }}
    >
      {/* Copilot 头部 */}
      <div 
        className="flex items-center justify-between p-4 border-b border-slate-100 cursor-move"
        onMouseDown={(e) => handleMouseDown(e, 'copilot')}
      >
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 pointer-events-none">
          <IconMessageSquare className="w-5 h-5 text-indigo-600" />
          AI 简历助手
        </h3>
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              if (confirm('确定要清空聊天记录吗？')) {
                clearCopilotMessages()
                setAppliedCodeBlocks({})
              }
            }}
            className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-red-500"
            title="清空聊天记录"
          >
            <IconTrash className="w-4 h-4" />
          </button>
          <button
            onClick={toggleCopilot}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <IconX className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* 聊天区域 */}
      <div
        id="copilot-messages"
        className="flex-1 overflow-y-auto p-4 space-y-4"
        ref={scrollRef}
      >
        {(Array.isArray(copilotMessages) ? copilotMessages : []).map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <IconMessageSquare className="w-4 h-4 text-indigo-600" />
              </div>
            )}
            <div
              className={`max-w-[280px] p-3 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-900'
              } markdown-copilot text-sm leading-relaxed`}
            >
              {message.role === 'user' ? (
                message.content
              ) : (
                <ReactMarkdown
                  components={{
                    p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({children}) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-1">{children}</ul>,
                    ol: ({children}) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-1">{children}</ol>,
                    li: ({children}) => <li>{children}</li>,
                    strong: ({children}) => <span className="font-semibold">{children}</span>,
                    code: ({ inline, children, ...props }: MarkdownCodeProps) => {
                        const codeContent = String(children).replace(/\n$/, '')
                        // Generate a simple hash/id for this block based on content length and first few chars
                        const blockId = `${index}-${codeContent.length}-${codeContent.slice(0,50)}`
                        const isApplied = appliedCodeBlocks[blockId]
                        
                        if (!inline) {
                            return (
                                <div className="relative group my-2">
                                    <div className="bg-slate-800 text-slate-200 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                                        <pre>{children}</pre>
                                    </div>
                                    <button 
                                        onClick={() => handleApplyCodeBlock(codeContent, blockId)}
                                        className={`absolute top-2 right-2 opacity-100 text-xs px-2 py-1 rounded transition-all shadow-md ${
                                            isApplied 
                                              ? 'bg-green-600 text-white cursor-default' 
                                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                        }`}
                                        disabled={isApplied}
                                        title={isApplied ? "已应用" : "应用此段代码到简历"}
                                    >
                                        {isApplied ? (
                                            <span className="flex items-center gap-1">
                                                <IconCheck className="w-3 h-3" /> 已应用
                                            </span>
                                        ) : "应用修改"}
                                    </button>
                                </div>
                            )
                        }
                        return <code className="bg-slate-200 px-1 rounded text-xs font-mono" {...props}>{children}</code>
                    }
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
            </div>
            {message.role === 'user' && (
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                <IconCheck className="w-4 h-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}
        
        {/* Loading Indicator */}
        {isCopilotLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              <IconMessageSquare className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <form onSubmit={handleCopilotSubmit} className="p-4 border-t border-slate-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={copilotInput}
            onChange={(e) => setCopilotInput(e.target.value)}
            placeholder="输入您的问题..."
            className="flex-1 px-4 py-2 bg-slate-100 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          <button
            type="submit"
            disabled={!copilotInput.trim()}
            className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconSend className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  )

  // 主渲染逻辑
  return (
    <div className="min-h-screen">
      {state.currentPage === 'hero' && renderHeroView()}
      {state.currentPage === 'dashboard' && renderDashboard()}
    </div>
  )
}

export default HomePage
