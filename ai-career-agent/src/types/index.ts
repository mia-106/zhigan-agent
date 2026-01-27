// Common types used across the application

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
}

export interface DiagnosticResult {
  summary: {
    total_score: number
    career_persona: string
    short_feedback: string
  }
  deep_diagnostic: {
    interviewer_fears: string[]
    hidden_gems: string[]
    flash_points: string[]
  }
  skills_matrix: {
    hard_skills: {
      matched: string[]
      gaps: string[]
      comment: string
    }
    transferable_power: {
      lever_found: string
      impact: string
    }
  }
  optimization_tips: Array<{
    original_text: string
    suggested_text: string
    why: string
  }>
  learning_strategy: {
    type: string
    priority_zero: string
    timeline:
      | Array<{
          stage: string
          task: string
        }>
      | string
      | { plan?: string }
    interview_defense: string
  }
  radar_data: {
    score: number
    matchAnalysis: Array<{
      dimension: string
      score: number
      analysis: string
    }>
  }
}

export interface StrategyData {
  strengths: string[]
  newAchievements: string
}

export interface InterviewPersona {
  id: 'TA' | 'HM' | 'Director'
  label: string
  description: string
  defaultQuestions: number
}

export interface ChatHistoryItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface ReviewData {
  overallScore: number
  breakdown: {
    technical: number
    communication: number
    problemSolving: number
    culturalFit: number
  }
  feedback: string
  recommendations: string[]
}

// Legacy types (may be removed)
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

export interface Skill {
  id: string
  name: string
  category: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
}

export interface JobPreference {
  jobTypes: string[]
  locations: string[]
  industries: string[]
  salaryRange: [number, number]
  experienceLevel: 'entry' | 'junior' | 'mid' | 'senior' | 'lead' | 'executive'
}

export interface AssessmentResult {
  id: string
  userId: string
  score: number
  recommendations: string[]
  strengths: string[]
  areasForImprovement: string[]
  suggestedRoles: string[]
  createdAt: Date
}

export interface ResumeSection {
  type: 'personal' | 'education' | 'experience' | 'skills' | 'projects' | 'certifications'
  content: string
  suggestions?: string[]
}
