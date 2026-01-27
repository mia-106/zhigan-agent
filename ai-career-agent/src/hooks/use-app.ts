import { useAppStore } from '@/lib/store'

export function useApp() {
  const store = useAppStore()

  return {
    // State
    state: store,

    // Navigation
    navigateTo: store.navigateTo,
    setActiveTab: store.setActiveTab,
    currentPage: store.currentPage,
    activeTab: store.activeTab,

    // Data
    jobDescriptions: store.jobDescriptions,
    setJobDescriptions: store.setJobDescriptions,
    resumeText: store.resumeText,
    setResumeText: store.setResumeText,
    isAnalyzing: store.isAnalyzing,
    setIsAnalyzing: store.setIsAnalyzing,

    // Diagnostic
    diagnosticResult: store.diagnosticResult,
    setDiagnosticResult: store.setDiagnosticResult,

    // Refinement
    refinementStep: store.refinementStep,
    setRefinementStep: store.setRefinementStep,
    strategyData: store.strategyData,
    setStrategyData: store.setStrategyData,
    refinedContent: store.refinedContent,
    setRefinedContent: store.setRefinedContent,

    // Interview
    interviewStatus: store.interviewStatus,
    setInterviewStatus: store.setInterviewStatus,
    interviewPersona: store.interviewPersona,
    setInterviewPersona: store.setInterviewPersona,
    chatHistory: store.chatHistory,
    setChatHistory: store.setChatHistory,
    inputMessage: store.inputMessage,
    setInputMessage: store.setInputMessage,
    reviewData: store.reviewData,
    setReviewData: store.setReviewData,
    interviewHistory: store.interviewHistory,
    addInterviewHistory: store.addInterviewHistory,
    deleteInterviewHistory: store.deleteInterviewHistory,

    // Copilot
    isCopilotOpen: store.isCopilotOpen,
    toggleCopilot: store.toggleCopilot,
    isCopilotLoading: store.isCopilotLoading,
    setIsCopilotLoading: store.setIsCopilotLoading,
    copilotMessages: store.copilotMessages,
    setCopilotMessages: store.setCopilotMessages,
    clearCopilotMessages: store.clearCopilotMessages,
    copilotInput: store.copilotInput,
    setCopilotInput: store.setCopilotInput,

    // Reset functions
    resetDiagnostic: store.resetDiagnostic,
    resetRefinement: store.resetRefinement,
    resetInterview: store.resetInterview,
    clearAllData: store.clearAllData,
  }
}