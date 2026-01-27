import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DiagnosticResult } from '@/types'
type StrategyData = {
  strengths: string[]
  newAchievements: string
}
type InterviewMessage = {
  role: 'user' | 'assistant'
  content: string
  metadata?: { isFollowUp?: boolean; internalNote?: string }
}
type ReviewData = {
  score?: number
  strengths?: string[]
  detailedFeedback?: string
  questionsAnalysis?: { question: string; userAnswer: string; referenceAnswer: string }[]
  weaknesses?: string[]
  suggestions?: string
}
type InterviewHistoryRecord = {
  id: string
  date: string
  persona: string
  reviewData: ReviewData
  chatHistory: InterviewMessage[]
}
type CopilotMessage = { role: 'user' | 'assistant'; content: string }

interface AppState {
  // Navigation
  currentPage: 'hero' | 'dashboard'
  activeTab: 'diagnostic' | 'refinement' | 'interview'

  // User Configuration
  apiKey: string
  showApiKeyModal: boolean
  jobDescriptions: string[]
  resumeText: string
  isAnalyzing: boolean

  // Diagnostic State
  diagnosticResult: DiagnosticResult | null

  // Refinement State
  refinementStep: number
  strategyData: StrategyData
  refinedContent: string

  // Interview State
  interviewStatus: 'setup' | 'active' | 'review'
  interviewPersona: 'TA' | 'HM' | 'Director'
  targetQuestionCount: number
  currentQuestionCount: number
  chatHistory: InterviewMessage[]
  inputMessage: string
  reviewData: ReviewData | null
  interviewHistory: InterviewHistoryRecord[]

  // AI Copilot State
  isCopilotOpen: boolean
  isCopilotLoading: boolean
  copilotMessages: CopilotMessage[]
  copilotInput: string

  // Actions
  updateState: (updates: Partial<AppState>) => void
  navigateTo: (page: 'hero' | 'dashboard') => void
  setActiveTab: (tab: 'diagnostic' | 'refinement' | 'interview') => void
  setShowApiKeyModal: (show: boolean) => void
  setApiKey: (key: string) => void
  setJobDescriptions: (descriptions: string[]) => void
  setResumeText: (text: string) => void
  setIsAnalyzing: (analyzing: boolean) => void
  setDiagnosticResult: (result: DiagnosticResult | null) => void
  setRefinementStep: (step: number) => void
  setStrategyData: (data: StrategyData) => void
  setRefinedContent: (content: string) => void
  setInterviewStatus: (status: 'setup' | 'active' | 'review') => void
  setInterviewPersona: (persona: 'TA' | 'HM' | 'Director') => void
  setChatHistory: (history: InterviewMessage[]) => void
  setInputMessage: (message: string) => void
  setReviewData: (data: ReviewData | null) => void
  addInterviewHistory: (record: InterviewHistoryRecord) => void
  deleteInterviewHistory: (id: string) => void
  toggleCopilot: () => void
  setIsCopilotLoading: (loading: boolean) => void
  setCopilotMessages: (messages: CopilotMessage[]) => void
  setCopilotInput: (input: string) => void
  clearCopilotMessages: () => void
  resetDiagnostic: () => void
  resetRefinement: () => void
  resetInterview: () => void
  clearAllData: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentPage: 'hero',
      activeTab: 'diagnostic',
      apiKey: '',
      showApiKeyModal: false,
      jobDescriptions: [''],
      resumeText: '',
      isAnalyzing: false,
      diagnosticResult: null,
      refinementStep: 0,
      strategyData: {
        strengths: [],
        newAchievements: ''
      },
      refinedContent: '',
      interviewStatus: 'setup',
      interviewPersona: 'TA',
      targetQuestionCount: 3,
      currentQuestionCount: 0,
      chatHistory: [],
      inputMessage: '',
      reviewData: null,
      interviewHistory: [],
      isCopilotOpen: false,
      isCopilotLoading: false,
      copilotMessages: [
        { role: 'assistant', content: '你好！我是你的简历 AI 助手。你可以问我关于简历修改的问题，或者直接让我帮你优化某段经历。' }
      ],
      copilotInput: '',

      clearCopilotMessages: () => set({
        copilotMessages: [
          { role: 'assistant', content: '你好！我是你的简历 AI 助手。你可以问我关于简历修改的问题，或者直接让我帮你优化某段经历。' }
        ]
      }),

      // Actions
      updateState: (updates) => set((state) => ({ ...state, ...updates })),

      navigateTo: (page) => set({ currentPage: page }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setShowApiKeyModal: (show) => set({ showApiKeyModal: show }),

      setApiKey: (key) => set({ apiKey: key }),

      setJobDescriptions: (descriptions) => set({ jobDescriptions: descriptions }),

      setResumeText: (text) => set({ resumeText: text }),

      setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

      setDiagnosticResult: (result) => set({ diagnosticResult: result }),

      setRefinementStep: (step) => set({ refinementStep: step }),

      setStrategyData: (data) => set({ strategyData: data }),

      setRefinedContent: (content) => set({ refinedContent: content }),

      setInterviewStatus: (status) => set({ interviewStatus: status }),

      setInterviewPersona: (persona) => set({ interviewPersona: persona }),

      setChatHistory: (history) => set({ chatHistory: history }),

      setInputMessage: (message) => set({ inputMessage: message }),

      setReviewData: (data) => set({ reviewData: data }),
      
      addInterviewHistory: (record) => set((state) => ({ 
        interviewHistory: [record, ...state.interviewHistory] 
      })),

      deleteInterviewHistory: (id) => set((state) => ({
        interviewHistory: state.interviewHistory.filter(h => h.id !== id)
      })),

      toggleCopilot: () => set((state) => ({ isCopilotOpen: !state.isCopilotOpen })),

      setIsCopilotLoading: (loading) => set({ isCopilotLoading: loading }),

      setCopilotMessages: (messages) => set({ copilotMessages: messages }),

      setCopilotInput: (input) => set({ copilotInput: input }),

      resetDiagnostic: () => set({
        diagnosticResult: null,
      }),

      resetRefinement: () => set({
        refinementStep: 0,
        strategyData: {
          strengths: [],
          newAchievements: ''
        },
        refinedContent: '',
      }),

      resetInterview: () => set({
        interviewStatus: 'setup',
        chatHistory: [],
        inputMessage: '',
        reviewData: null,
      }),

      clearAllData: () => set({
        currentPage: 'hero',
        activeTab: 'diagnostic',
        apiKey: '',
        showApiKeyModal: false,
        jobDescriptions: [''],
        resumeText: '',
        isAnalyzing: false,
        diagnosticResult: null,
        refinementStep: 0,
        strategyData: {
          strengths: [],
          newAchievements: ''
        },
        refinedContent: '',
        interviewStatus: 'setup',
        interviewPersona: 'TA',
        chatHistory: [],
        inputMessage: '',
        reviewData: null,
        interviewHistory: [],
        copilotMessages: [
          { role: 'assistant', content: '你好！我是你的简历 AI 助手。你可以问我关于简历修改的问题，或者直接让我帮你优化某段经历。' }
        ],
      }),
    }),
    {
      name: 'zhigan-studio-storage',
      partialize: (state) => ({
        jobDescriptions: state.jobDescriptions,
        resumeText: state.resumeText,
        diagnosticResult: state.diagnosticResult,
        refinementStep: state.refinementStep,
        strategyData: state.strategyData,
        refinedContent: state.refinedContent,
        interviewStatus: state.interviewStatus,
        interviewPersona: state.interviewPersona,
        chatHistory: state.chatHistory,
        reviewData: state.reviewData,
        interviewHistory: state.interviewHistory,
        isCopilotOpen: state.isCopilotOpen,
        copilotMessages: state.copilotMessages,
      }),
    }
  )
)
