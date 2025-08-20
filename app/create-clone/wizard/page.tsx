"use client"

import { RequireCreator } from '@/components/auth/protected-route';
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from 'next/navigation'
// Removed API imports - now using direct Supabase operations
interface CloneCreateRequest {
  name: string;
  category: string;
  expertise_areas: string[];
  base_price: number;
  bio?: string;
  personality_traits?: Record<string, any>;
  communication_style?: Record<string, any>;
  languages: string[];
}
// Removed complex knowledge-api - now using direct Supabase operations
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { getAuthTokens } from '@/lib/api-client';
import { setupStorageBuckets, checkStorageBuckets } from '@/lib/setup-storage';
import { toast } from '@/components/ui/use-toast';
// Removed: EnhancedProcessingMonitor import (RAG functionality removed)
import { EnhancedDocumentUpload } from '@/components/document-upload/enhanced-document-upload';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileText,
  LinkIcon,
  MessageCircle,
  Mic,
  Video,
  Play,
  CheckCircle,
  Stethoscope,
  Briefcase,
  GraduationCap,
  DollarSign,
  Heart,
  Scale,
  X,
  Plus,
  Cpu,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const expertTypes = {
  medical: { color: "bg-emerald-500", icon: Stethoscope, name: "Health & Wellness", theme: "emerald" },
  business: { color: "bg-blue-500", icon: Briefcase, name: "Business & Strategy", theme: "blue" },
  education: { color: "bg-purple-500", icon: GraduationCap, name: "Education & Learning", theme: "purple" },
  finance: { color: "bg-amber-500", icon: DollarSign, name: "Finance & Investment", theme: "amber" },
  coaching: { color: "bg-orange-500", icon: Heart, name: "Life & Coaching", theme: "orange" },
  legal: { color: "bg-indigo-900", icon: Scale, name: "Legal & Consulting", theme: "indigo" },
  ai: { color: "bg-cyan-600", icon: Cpu, name: "AI", theme: "cyan" },
  other: { color: "bg-slate-600", icon: MoreHorizontal, name: "Other", theme: "slate" },
}

const steps = [
  { id: 1, title: "Basic Information", description: "Profile and credentials" },
  { id: 2, title: "Q&A Training", description: "Train with questions" },
  { id: 3, title: "Knowledge Transfer", description: "Upload your expertise" },
  { id: 4, title: "Personality & Style", description: "Define communication style" },
  { id: 5, title: "Media Training", description: "Voice and video setup" },
  { id: 6, title: "Testing & Preview", description: "Test your clone" },
  { id: 7, title: "Pricing & Launch", description: "Set rates and publish" },
]

const personalityTraits = [
  { key: "formal", label: "Formal ↔ Casual", min: "Very Formal", max: "Very Casual" },
  { key: "detailed", label: "Concise ↔ Detailed", min: "Very Concise", max: "Very Detailed" },
  { key: "supportive", label: "Direct ↔ Supportive", min: "Very Direct", max: "Very Supportive" },
  { key: "analytical", label: "Intuitive ↔ Analytical", min: "Very Intuitive", max: "Very Analytical" },
  { key: "patient", label: "Quick ↔ Patient", min: "Very Quick", max: "Very Patient" },
]

const availableLanguages = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese", "Dutch", "Russian",
  "Chinese (Mandarin)", "Japanese", "Korean", "Arabic", "Hindi", "Bengali", "Urdu",
  "Turkish", "Polish", "Swedish", "Norwegian", "Danish", "Finnish", "Hebrew", "Thai",
  "Vietnamese", "Indonesian", "Malay", "Greek", "Czech", "Hungarian", "Romanian"
]

const universalQuestions = [
  {
    id: 1,
    question: "Describe your professional background and what makes you uniquely qualified in your field.",
    placeholder: "Share your experience, education, key achievements, and what sets you apart from others in your domain..."
  },
  {
    id: 2,
    question: "What's your approach to helping people achieve their goals and overcome challenges?",
    placeholder: "Explain your methodology, philosophy, and the steps you typically take when working with someone..."
  },
  {
    id: 3,
    question: "How do you adapt your communication style and advice for different types of people?",
    placeholder: "Describe how you adjust your approach based on personality, experience level, cultural background, etc..."
  },
  {
    id: 4,
    question: "What are the most common problems or misconceptions people have in your area of expertise?",
    placeholder: "Share the frequent mistakes, myths, or challenges you encounter and how you address them..."
  },
  {
    id: 5,
    question: "What practical advice would you give to someone just starting their journey in your field?",
    placeholder: "Provide actionable first steps, essential tips, and key principles for beginners to follow..."
  }
]

function CloneWizardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [createdCloneId, setCreatedCloneId] = useState<string | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)

  // RAG processing state
  const [isProcessingKnowledge, setIsProcessingKnowledge] = useState(false)
  const [knowledgeProcessingStatus, setKnowledgeProcessingStatus] = useState<string>('pending')
  const [retryCount, setRetryCount] = useState(0)
  const [processingProgress, setProcessingProgress] = useState<{ completed: number; total: number; errors: string[] }>({ completed: 0, total: 0, errors: [] })
  
  // Track which documents have been processed to prevent duplicates
  const [processedDocuments, setProcessedDocuments] = useState<Set<string>>(new Set())
  const [hasTriggeredProcessing, setHasTriggeredProcessing] = useState(false)
  const [lastProcessedCloneId, setLastProcessedCloneId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    name: "",
    title: "",
    bio: "",
    expertise: "",
    customDomain: "",
    credentials: "",
    languages: [] as string[],
    photo: null as File | null,
    existingAvatarUrl: "",

    // Step 2: Q&A Training
    qaResponses: {} as Record<string, string>,

    // Step 3: Knowledge Transfer
    documents: [] as File[],
    links: [] as string[],
    existingDocuments: [] as Array<{name: string; url: string; status: string; type: string; id: string}>,
    existingLinks: [] as Array<{name: string; url: string; status: string; type: string; id: string}>,

    // Step 4: Personality & Style
    personality: {
      formal: [50],
      detailed: [50],
      supportive: [50],
      analytical: [50],
      patient: [50],
    },
    communicationStyle: "professional",
    responseLength: "medium",

    // Step 5: Media Training
    audioSample: null as File | null,
    videoSample: null as File | null,
    enableAudio: false,
    enableVideo: false,

    // Step 6: Testing & Preview
    testPrompt: "",
    testResponse: "",
    testResults: {
      accuracy: 85,
      personality: 92,
      knowledge: 88,
    },

    // Step 7: Pricing & Launch
    pricing: {
      text: { min: 25, max: 50 },
      voice: { min: 35, max: 75 },
      video: { min: 50, max: 100 },
    },
    availability: "24/7",
    status: "draft" as "draft" | "published",
  })

  const [newLanguage, setNewLanguage] = useState("")
  const [newLink, setNewLink] = useState("")

  // Load existing clone data if editing
  useEffect(() => {
    const cloneId = searchParams.get('clone_id')
    if (cloneId && cloneId !== createdCloneId) {
      console.log('Loading clone data from URL parameter:', cloneId)
      loadCloneData(cloneId)
    } else if (cloneId && cloneId === createdCloneId) {
      console.log('Clone ID from URL matches current clone, no need to reload')
    }
  }, [searchParams, createdCloneId])

  const loadCloneData = async (cloneId: string) => {
    try {
      setIsLoading(true)
      setCreatedCloneId(cloneId)
      const supabase = createClient()
      
      const { data: clone, error } = await supabase
        .from('clones')
        .select('*')
        .eq('id', cloneId)
        .eq('creator_id', user?.id)
        .single()
      
      if (error) {
        console.error('Error loading clone data:', error)
        toast({
          title: "Error loading clone data",
          description: "Could not load existing clone data",
          variant: "destructive",
        })
        return
      }
      
      if (clone) {
        console.log('Loading clone data:', clone)
        console.log('Credentials from DB:', clone.credentials_qualifications)
        console.log('Credentials type:', typeof clone.credentials_qualifications)
        console.log('Avatar URL from DB:', clone.avatar_url)
        console.log('Expertise areas from DB:', clone.expertise_areas)
        
        // Load credentials as simple text
        const credentialsText = clone.credentials_qualifications || ""
        console.log('Loading credentials as text:', credentialsText)
        
        // Load Q&A responses
        const qaResponses = await loadQAResponses(cloneId)
        
        // Load knowledge data
        const knowledgeData = await loadKnowledgeData(cloneId)
        
        // Reset processing flags when loading existing clone
        setHasTriggeredProcessing(false)
        setLastProcessedCloneId(null)
        setProcessedDocuments(new Set())
        
        // Populate form data with existing clone data
        setFormData({
          // Step 1: Basic Information
          name: clone.name || "",
          title: clone.professional_title || "",
          bio: clone.bio || "",
          expertise: clone.category || "",
          customDomain: clone.category === 'other' || !Object.keys(expertTypes).includes(clone.category) ? clone.category : "",
          credentials: credentialsText,
          languages: clone.languages || ['English'],
          photo: null,
          existingAvatarUrl: clone.avatar_url || "",

          // Step 2: Q&A Training - load from clone_qa_training table
          qaResponses: qaResponses,

          // Step 3: Knowledge Transfer
          documents: [],
          links: [],
          existingDocuments: knowledgeData.documents || [],
          existingLinks: knowledgeData.links || [],

          // Step 4: Personality & Style
          personality: clone.personality_traits || {
            formal: [50],
            detailed: [50],
            supportive: [50],
            analytical: [50],
            patient: [50],
          },
          communicationStyle: clone.communication_style?.style || "professional",
          responseLength: clone.communication_style?.response_length || "medium",

          // Step 5: Media Training
          audioSample: null,
          videoSample: null,
          enableAudio: false,
          enableVideo: false,

          // Step 6: Testing & Preview
          testPrompt: "",
          testResponse: "",
          testResults: {
            accuracy: 85,
            personality: 92,
            knowledge: 88,
          },

          // Step 7: Pricing & Launch
          pricing: {
            text: { min: clone.base_price || 25, max: clone.base_price || 25 },
            voice: { min: Math.floor((clone.base_price || 25) * 1.5), max: Math.floor((clone.base_price || 25) * 1.5) },
            video: { min: Math.floor((clone.base_price || 25) * 2), max: Math.floor((clone.base_price || 25) * 2) },
          },
          isPublished: clone.is_published || false,
        })
        
        // Set knowledge processing status if we have existing knowledge
        if (knowledgeData.documents.length > 0 || knowledgeData.links.length > 0) {
          setKnowledgeProcessingStatus(knowledgeData.processingStatus)
          console.log('Set knowledge processing status:', knowledgeData.processingStatus)
        }
        
        toast({
          title: "Clone data loaded",
          description: `Your existing clone data has been loaded for editing. Found ${knowledgeData.documents.length} documents and ${knowledgeData.links.length} links.`,
        })

        // Navigate to the first incomplete section after data loads, but respect existing processing state
        setTimeout(() => {
          const nextIncompleteStep = findFirstIncompleteSection()
          console.log('Navigating to first incomplete section:', nextIncompleteStep)
          setCurrentStep(nextIncompleteStep)
          
          // Set processing status based on existing knowledge
          if (knowledgeData.documents.length > 0 || knowledgeData.links.length > 0) {
            console.log('Setting processing flags for existing clone with knowledge')
            setHasTriggeredProcessing(true)
            setLastProcessedCloneId(cloneId)
          }
        }, 100)
      }
    } catch (error) {
      console.error('Error loading clone:', error)
      toast({
        title: "Error loading clone",
        description: "Please try again later",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }
  const [isTestingClone, setIsTestingClone] = useState(false)
  const [testingMode, setTestingMode] = useState<'text' | 'audio' | 'video'>('text')
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [testMessages, setTestMessages] = useState([
    {
      id: "1",
      content: "Hello! I'm your AI clone. I'm ready to help with your questions. What would you like to discuss?",
      sender: "clone" as "user" | "clone",
      timestamp: new Date(),
    },
  ])

  // Update greeting message when expertise changes
  useEffect(() => {
    const domain = formData.expertise === 'other' ? formData.customDomain : formData.expertise
    const greeting = domain 
      ? `Hello! I'm your AI clone. I'm ready to help with questions about ${domain}. What would you like to discuss?`
      : "Hello! I'm your AI clone. I'm ready to help with your questions. What would you like to discuss?"
    
    setTestMessages(prev => [
      {
        ...prev[0],
        content: greeting
      },
      ...prev.slice(1)
    ])
  }, [formData.expertise, formData.customDomain])
  
  // Enhanced state management for processing flags and duplicate prevention
  useEffect(() => {
    if (currentStep !== 3) {
      // Clear processing flags if we're not on the knowledge transfer step
      if (hasTriggeredProcessing && currentStep > 3) {
        // Only keep processing flags if we've moved forward past step 3
        console.log('Moved past step 3, keeping processing flags to prevent re-processing')
      } else if (currentStep < 3) {
        // If we go back before step 3, clear everything
        console.log('Navigated back before step 3, clearing all processing flags')
        setHasTriggeredProcessing(false)
        setLastProcessedCloneId(null)
        setProcessedDocuments(new Set())
      }
    }
  }, [currentStep, hasTriggeredProcessing])
  
  // Prevent duplicate processing when clone ID changes
  useEffect(() => {
    if (createdCloneId && createdCloneId !== lastProcessedCloneId) {
      console.log('Clone ID changed, resetting processing flags:', { 
        old: lastProcessedCloneId, 
        new: createdCloneId 
      })
      setHasTriggeredProcessing(false)
      setProcessedDocuments(new Set())
    }
  }, [createdCloneId, lastProcessedCloneId])
  const [testInput, setTestInput] = useState("")

  // Calculate progress based on sections completed
  const calculateProgress = () => {
    const totalSections = 7 // Total number of sections
    let completedSections = 0
    
    // Section 1: Basic Information
    const section1Complete = formData.name && formData.title && formData.expertise && formData.bio &&
      (formData.expertise !== "other" || formData.customDomain)
    
    console.log('Section 1 Debug:', {
      name: !!formData.name,
      title: !!formData.title,
      expertise: !!formData.expertise,
      bio: !!formData.bio,
      customDomain: formData.customDomain,
      expertiseValue: formData.expertise,
      section1Complete
    })
    
    if (section1Complete) {
      completedSections++
    }
    
    // Section 2: Q&A Training
    const answeredQuestions = Object.values(formData.qaResponses).filter(answer => answer && answer.trim()).length
    const section2Complete = answeredQuestions >= 5
    
    console.log('Section 2 Debug:', {
      qaResponses: formData.qaResponses,
      answeredQuestions,
      section2Complete
    })
    
    if (section2Complete) {
      completedSections++
    }
    
    // Section 3: Knowledge Transfer (optional but shows status if has content)
    const hasKnowledgeContent = (formData.documents && formData.documents.length > 0) || 
                               (formData.links && formData.links.length > 0) ||
                               (formData.existingDocuments && formData.existingDocuments.length > 0) ||
                               (formData.existingLinks && formData.existingLinks.length > 0)
    // Always count as completed since it's optional, but log status for debugging
    completedSections++
    
    console.log('Section 3 Debug:', {
      hasDocuments: formData.documents?.length || 0,
      hasLinks: formData.links?.length || 0,
      hasExistingDocuments: formData.existingDocuments?.length || 0,
      hasExistingLinks: formData.existingLinks?.length || 0,
      hasKnowledgeContent,
      knowledgeProcessingStatus
    })
    
    // Section 4: Personality & Style
    const section4Complete = formData.communicationStyle && formData.responseLength
    console.log('Section 4 Debug:', {
      communicationStyle: formData.communicationStyle,
      responseLength: formData.responseLength,
      section4Complete
    })
    
    if (section4Complete) {
      completedSections++
    }
    
    // Section 5: Media Training (optional - always counts as completed)
    completedSections++
    
    // Section 6: Testing & Preview (always counts as completed)
    completedSections++
    
    // Section 7: Pricing & Launch
    const section7Complete = formData.pricing.text.min > 0 && formData.pricing.voice.min > 0 && formData.pricing.video.min > 0
    console.log('Section 7 Debug:', {
      pricingText: formData.pricing.text.min,
      pricingVoice: formData.pricing.voice.min,
      pricingVideo: formData.pricing.video.min,
      section7Complete
    })
    
    if (section7Complete) {
      completedSections++
    }
    
    const progressPercentage = Math.round((completedSections / totalSections) * 100)
    console.log('Progress Calculation:', {
      completedSections,
      totalSections,
      progressPercentage,
      formData
    })
    
    return progressPercentage
  }

  // Function to find the first incomplete section
  const findFirstIncompleteSection = () => {
    // Section 1: Basic Information
    const section1Complete = formData.name && formData.title && formData.expertise && formData.bio &&
      (formData.expertise !== "other" || formData.customDomain)
    if (!section1Complete) return 1

    // Section 2: Q&A Training
    const answeredQuestions = Object.values(formData.qaResponses).filter(answer => answer && answer.trim()).length
    if (answeredQuestions < 5) return 2

    // Section 3: Knowledge Transfer (optional - skip to next if not needed)
    // Since this is optional, check if section 4 is complete
    
    // Section 4: Personality & Style
    const section4Complete = formData.communicationStyle && formData.responseLength
    if (!section4Complete) return 4

    // Section 5: Media Training (optional - skip to next)
    
    // Section 6: Testing & Preview (always available)
    
    // Section 7: Pricing & Launch
    const section7Complete = formData.pricing.text.min > 0 && formData.pricing.voice.min > 0 && formData.pricing.video.min > 0
    if (!section7Complete) return 7

    // If all are complete, go to step 6 (Testing)
    return 6
  }
  
  const progress = calculateProgress()

  // Generate system prompt for OpenAI based on clone data
  const generateSystemPrompt = () => {
    const qaContext = Object.entries(formData.qaResponses)
      .filter(([_, answer]) => answer && answer.trim())
      .map(([question, answer]) => `Q: ${question}\nA: ${answer}`)
      .join('\n\n')

    const personalityTraits = Object.entries(formData.personality)
      .map(([trait, value]) => `${trait}: ${value[0]}/100`)
      .join(', ')

    const systemPrompt = `You are ${formData.name}, a professional ${formData.title || 'expert'} specializing in ${formData.expertise}.

PROFESSIONAL BACKGROUND:
${formData.credentials ? `Credentials & Qualifications: ${formData.credentials}` : ''}
Bio: ${formData.bio}

PERSONALITY TRAITS (scale 1-100):
${personalityTraits}

COMMUNICATION STYLE:
- Style: ${formData.communicationStyle}
- Response Length: ${formData.responseLength}
- Languages: ${formData.languages.join(', ')}

TRAINING DATA & EXPERTISE:
${qaContext}

INSTRUCTIONS:
- Respond as ${formData.name} would, drawing from your professional background and training data
- Match the specified personality traits and communication style
- Stay in character and provide helpful, professional advice within your area of expertise
- If asked about topics outside your expertise, acknowledge your limitations and redirect to your strengths
- Keep responses ${formData.responseLength === 'short' ? 'concise (1-2 sentences)' : formData.responseLength === 'medium' ? 'moderate length (2-4 sentences)' : 'detailed (multiple paragraphs)'}
- Use a ${formData.communicationStyle} tone throughout`

    return systemPrompt
  }

  // Test clone with OpenAI API or RAG
  const testCloneWithAI = async (userMessage: string) => {
    try {
      const supabase = createClient()
      // Check if we should use RAG or fallback to basic OpenAI
      if (createdCloneId && knowledgeProcessingStatus === 'completed' && (formData.documents.length > 0 || formData.links.length > 0)) {
        console.log('Using RAG-powered testing for clone:', createdCloneId)
        
        // Get current Supabase session for authentication
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session) {
          console.error('Failed to get Supabase session:', sessionError)
          throw new Error('Authentication session expired. Please refresh the page and try again.')
        }

        // Use RAG endpoint for enhanced responses
        const response = await fetch(`/api/clones/${createdCloneId}/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            query: userMessage,
            memory_type: 'expert'
          })
        })

        console.log('RAG clone query response status:', response.status, response.statusText)
        
        if (response.ok) {
          const responseText = await response.text()
          console.log('RAG clone query response text:', responseText)
          
          let data;
          try {
            data = JSON.parse(responseText)
            console.log('RAG response:', data)
          } catch (parseError) {
            console.error('Failed to parse RAG response:', parseError)
            return "I'm sorry, I received an invalid response from the server."
          }
          
          // Return the RAG response with citation info if available
          let responseMessage = data.response || "I'm sorry, I couldn't process that question."
          
          if (data.citations && data.citations.length > 0) {
            responseMessage += '\n\n📚 *Based on your uploaded knowledge materials*'
          }
          
          return responseMessage
        } else {
          console.warn('RAG endpoint failed, falling back to basic OpenAI')
        }
      }
      
      // Fallback to basic OpenAI API
      console.log('Using basic OpenAI testing (no RAG knowledge available)')
      
      const systemPrompt = generateSystemPrompt()
      
      console.log('System Prompt:', systemPrompt)
      console.log('User Message:', userMessage)
      
      const response = await fetch('/api/chat/test-clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt,
          userMessage,
          conversationHistory: testMessages.filter(msg => msg.sender !== 'clone' || msg.id === '1').map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content
          }))
        })
      })

      console.log('Clone query response status:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.log('Clone query error response:', errorText)
        
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error || `API Error: ${response.status}`)
        } catch (parseError) {
          throw new Error(`API Error ${response.status}: ${errorText.substring(0, 200)}`)
        }
      }

      const responseText = await response.text()
      console.log('Clone query success response:', responseText)
      
      try {
        const data = JSON.parse(responseText)
        return data.response
      } catch (parseError) {
        console.error('Failed to parse clone query response:', parseError)
        throw new Error('Invalid response from server')
      }

    } catch (error) {
      console.error('Error testing clone:', error)
      return "I'm sorry, I'm having trouble responding right now. Please try again later."
    }
  }

  // Enhanced clone verification with retry logic
  const verifyCloneExists = async (cloneId: string, maxAttempts: number = 5): Promise<boolean> => {
    const supabase = createClient()
    let verifyAttempts = 0;
    
    while (verifyAttempts < maxAttempts) {
      verifyAttempts++;
      const waitTime = 1000 * verifyAttempts; // 1s, 2s, 3s, 4s, 5s
      
      console.log(`Clone verification attempt ${verifyAttempts}/${maxAttempts} (after ${waitTime}ms wait)...`)
      
      if (verifyAttempts > 1) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
      
      try {
        const { data: cloneExists, error: cloneCheckError } = await supabase
          .from('clones')
          .select('id, name, creator_id')
          .eq('id', cloneId)
          .single()
          
        if (!cloneCheckError && cloneExists) {
          console.log(`Clone verified successfully after ${verifyAttempts} attempts:`, cloneExists)
          return true
        }
        
        console.log(`Verification attempt ${verifyAttempts} failed:`, cloneCheckError?.message)
      } catch (error) {
        console.log(`Verification attempt ${verifyAttempts} error:`, error)
      }
    }
    
    console.error('Clone verification failed after all attempts')
    return false
  }

  // RAG Knowledge Processing Function
  const retryKnowledgeProcessing = async (cloneId: string) => {
    if (!cloneId) return
    
    const supabase = createClient()
    setIsProcessingKnowledge(true)
    setKnowledgeProcessingStatus('processing')
    setRetryCount(prev => prev + 1)
    
    try {
      console.log('Starting knowledge processing retry for clone:', cloneId)
      
      // Show retry notification
      toast({
        title: "Retrying Processing...",
        description: `Attempting to process failed documents (Attempt ${retryCount})`,
      })
      
      // Verify clone exists before attempting processing
      const cloneExists = await verifyCloneExists(cloneId, 3)
      if (!cloneExists) {
        throw new Error('Clone verification failed. Please try saving the clone again.')
      }
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No authentication session found')
      }

      console.log('Using Supabase access token for retry processing')

      // Call the dedicated retry endpoint
      const response = await fetch(`/api/clones/${cloneId}/retry-processing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ retry_count: retryCount })
      })

      console.log('Retry processing response status:', response.status, response.statusText)
      
      if (!response.ok) {
        let errorData;
        const responseText = await response.text()
        console.log('Retry processing error response:', responseText)
        
        try {
          errorData = JSON.parse(responseText)
        } catch (parseError) {
          throw new Error(`Retry failed with ${response.status}: ${responseText.substring(0, 200)}`)
        }
        
        throw new Error(errorData.detail || errorData.error || `Retry failed: ${response.status}`)
      }

      const result = JSON.parse(await response.text())
      console.log('Retry processing result:', result)

      if (result.overall_status === 'completed') {
        setKnowledgeProcessingStatus('completed')
        setRetryCount(0) // Reset retry count on success
        toast({
          title: "✅ Retry Successful!",
          description: "Your documents have been successfully processed and integrated into your clone.",
        })
      } else if (result.overall_status === 'failed') {
        setKnowledgeProcessingStatus('failed')
        toast({
          title: `❌ Retry Failed (Attempt ${retryCount})`,
          description: retryCount >= 3 
            ? "Multiple retry attempts failed. Documents may have format issues. Continuing with basic mode."
            : "RAG processing failed - you can try again or continue with basic LLM mode for testing",
          variant: "destructive",
        })
      } else {
        setKnowledgeProcessingStatus('partial')
        toast({
          title: "⚠️ Partial Retry Success",
          description: "Some documents were processed successfully on retry, but others still failed.",
          variant: "destructive",
        })
      }

    } catch (error) {
      console.error('Retry processing error:', error)
      setKnowledgeProcessingStatus('failed')
      
      toast({
        title: `🔧 Retry Error (Attempt ${retryCount})`,
        description: error instanceof Error 
          ? `${error.message} - You can try again or continue with basic mode.`
          : "Retry failed due to an unexpected error. Continuing with basic LLM mode for testing.",
        variant: "destructive",
      })
    } finally {
      setIsProcessingKnowledge(false)
    }
  }

  const processKnowledgeWithRAG = async (cloneId: string) => {
    console.log('🔍 DEBUG: Starting RAG processing with formData:', {
      documentsCount: formData.documents.length,
      linksCount: formData.links.length,
      documents: formData.documents.map(doc => ({ name: doc.name, size: doc.size, type: doc.type })),
      links: formData.links,
      cloneId
    })

    if (formData.documents.length === 0 && formData.links.length === 0) {
      console.log('❌ No documents or links to process')
      return
    }

    // Prevent concurrent processing
    if (isProcessingKnowledge) {
      console.log('⚠️ RAG processing already in progress, skipping')
      return
    }

    try {
      const supabase = createClient()
      setIsProcessingKnowledge(true)
      setKnowledgeProcessingStatus('processing')
      setRetryCount(0) // Reset retry count when starting fresh processing
      setProcessingProgress({ completed: 0, total: formData.documents.length + formData.links.length, errors: [] })

      console.log('Starting RAG processing for clone:', cloneId)
      console.log('Clone ID type:', typeof cloneId)
      console.log('Clone ID length:', cloneId?.length)
      console.log('Clone ID is valid UUID:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cloneId))

      // Validate clone ID format
      if (!cloneId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cloneId)) {
        throw new Error(`Invalid clone ID format: ${cloneId}`)
      }

      // Ensure clone exists before starting processing
      const cloneExists = await ensureCloneExists(cloneId)
      if (!cloneExists) {
        throw new Error(`Clone not found or not accessible: ${cloneId}. Please refresh the page and try again.`)
      }

      // Check if required tables exist before proceeding
      const tablesExist = await ensureTablesExist()
      if (!tablesExist) {
        throw new Error('Required database tables are missing. Please contact support to run migrations.')
      }

      // Ensure domain exists for the clone's category
      const cloneDomain = formData.expertise === 'other' ? formData.customDomain : formData.expertise
      const { error: domainError } = await supabase.from('domains').upsert({
        domain_name: cloneDomain,
        expert_names: []
      }, { onConflict: 'domain_name' })

      if (domainError) {
        console.warn('Failed to create/update domain:', domainError)
      }

      // Prepare document URLs by uploading files first
      const processedDocuments: Array<{name: string; url: string; type: string}> = []
      const processedLinks: Array<{name: string; url: string; type: string}> = []

      // Process uploaded documents with enhanced duplicate detection
      for (let i = 0; i < formData.documents.length; i++) {
        const doc = formData.documents[i]
        
        // Skip if document already processed in this session
        if (processedDocuments.some(processed => processed.name === doc.name)) {
          console.log(`Skipping already processed document (session cache): ${doc.name}`)
          setProcessingProgress(prev => ({ ...prev, completed: prev.completed + 1 }))
          continue
        }
        
        // Skip if document already exists in knowledge base
        if (formData.existingDocuments?.some(existing => existing.name === doc.name)) {
          console.log(`Skipping already existing document in knowledge base: ${doc.name}`)
          setProcessingProgress(prev => ({ ...prev, completed: prev.completed + 1 }))
          continue
        }
        
        try {
          // Upload document to Supabase Storage first
          const fileUrl = await uploadFile(doc, 'knowledge-documents', 'clone-documents')
          if (fileUrl) {
            // Store document metadata in knowledge table
            const { error: knowledgeError } = await supabase.from('knowledge').insert({
              clone_id: cloneId,
              title: doc.name,
              description: `Uploaded document: ${doc.name}`,
              content_type: 'document',
              file_name: doc.name,
              file_url: fileUrl,
              file_type: doc.type,
              file_size_bytes: doc.size,
              content_preview: '', // Could extract first 500 chars if needed
              tags: ['training_material'],
              vector_store_status: 'pending' // Will be processed by OpenAI later
            })

            if (knowledgeError) {
              console.error('Failed to store document in knowledge table:', knowledgeError)
            }

            // Also store in documents table for RAG processing using upsert
            const { error: docError } = await supabase.from('documents').upsert({
              name: doc.name,
              document_link: fileUrl,
              created_by: user?.id,
              domain: cloneDomain,
              included_in_default: false,
              client_name: formData.name // Use clone name as client name
            }, {
              onConflict: 'name',
              ignoreDuplicates: false
            })

            if (docError) {
              console.error('Failed to store document in documents table:', docError)
            } else {
              console.log(`Document ${doc.name} stored in documents table successfully`)
            }

            processedDocuments.push({
              name: doc.name,
              url: fileUrl,
              type: 'document'
            })
            console.log(`Document ${doc.name} uploaded successfully:`, fileUrl)
            
            // Track processed document to prevent duplicates
            setProcessedDocuments(prev => new Set([...prev, doc.name]))
          }
          setProcessingProgress(prev => ({ ...prev, completed: prev.completed + 1 }))
        } catch (error) {
          console.error(`Failed to upload document ${doc.name}:`, error)
          setProcessingProgress(prev => ({ 
            ...prev, 
            completed: prev.completed + 1,
            errors: [...prev.errors, `Failed to upload ${doc.name}`]
          }))
        }
      }

      // Process links with enhanced duplicate detection
      for (const link of formData.links) {
        // Skip if link already processed in this session
        if (processedLinks.some(processed => processed.url === link)) {
          console.log(`Skipping already processed link (session cache): ${link}`)
          setProcessingProgress(prev => ({ ...prev, completed: prev.completed + 1 }))
          continue
        }
        
        // Skip if link already exists in knowledge base
        if (formData.existingLinks?.some(existing => existing.url === link)) {
          console.log(`Skipping already existing link in knowledge base: ${link}`)
          setProcessingProgress(prev => ({ ...prev, completed: prev.completed + 1 }))
          continue
        }
        
        try {
          // Store URL metadata in knowledge table
          const { error: knowledgeError } = await supabase.from('knowledge').insert({
            clone_id: cloneId,
            title: `Content from ${new URL(link).hostname}`,
            description: `Web content from: ${link}`,
            content_type: 'link',
            original_url: link,
            file_url: link, // Same as original for links
            content_preview: '', // Could fetch and preview if needed
            tags: ['web_content'],
            vector_store_status: 'pending' // Will be processed by OpenAI later
          })

          if (knowledgeError) {
            console.error('Failed to store URL in knowledge table:', knowledgeError)
          }

          // Also store in documents table for RAG processing using upsert
          const { error: docError } = await supabase.from('documents').upsert({
            name: `Web Content: ${new URL(link).hostname}`,
            document_link: link,
            created_by: user?.id,
            domain: cloneDomain,
            included_in_default: false,
            client_name: formData.name // Use clone name as client name
          }, {
            onConflict: 'name',
            ignoreDuplicates: false
          })

          if (docError) {
            console.error('Failed to store URL in documents table:', docError)
          } else {
            console.log(`Link ${link} stored in documents table successfully`)
          }

          processedLinks.push({
            name: link.split('/').pop() || 'Web Link',
            url: link,
            type: 'link'
          })
          
          // Track processed link to prevent duplicates
          setProcessedDocuments(prev => new Set([...prev, link]))
        } catch (error) {
          console.error(`Failed to process link ${link}:`, error)
        }
        setProcessingProgress(prev => ({ ...prev, completed: prev.completed + 1 }))
      }

      // Create or update expert for this clone
      if (processedDocuments.length > 0 || processedLinks.length > 0) {
        const expertName = formData.name || 'Unnamed Expert'
        const expertContext = `Expert specializing in ${cloneDomain}. ${formData.bio || ''}\n\nExpertise areas: ${formData.expertiseAreas?.join(', ') || 'General'}\n\nPersonality: ${JSON.stringify(formData.personality, null, 2)}`

        const { error: expertError } = await supabase.from('experts').upsert({
          name: expertName,
          domain: cloneDomain,
          context: expertContext
        }, { onConflict: 'name' })

        if (expertError) {
          console.error('Failed to create/update expert:', expertError)
        } else {
          console.log('Expert created/updated successfully:', expertName)
          
          // Update domain to include this expert
          const { data: domainData } = await supabase.from('domains')
            .select('expert_names')
            .eq('domain_name', cloneDomain)
            .single()

          if (domainData) {
            const currentExperts = domainData.expert_names || []
            if (!currentExperts.includes(expertName)) {
              const { error: updateError } = await supabase.from('domains')
                .update({ expert_names: [...currentExperts, expertName] })
                .eq('domain_name', cloneDomain)

              if (updateError) {
                console.error('Failed to update domain experts:', updateError)
              }
            }
          }
        }
      }

      // Prepare RAG processing request
      const ragRequest = {
        documents: processedDocuments,
        links: processedLinks
      }

      console.log('Sending RAG processing request:', ragRequest)

      // Wait for database consistency and retry with exponential backoff
      let response;
      let attempt = 0;
      const maxAttempts = 3;
      
      while (attempt < maxAttempts) {
        attempt++;
        const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 10000); // 2s, 4s, 8s max
        
        console.log(`Attempt ${attempt}/${maxAttempts}: Waiting ${waitTime}ms for database consistency...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))

        // Get current Supabase session for authentication
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session) {
          console.error('Failed to get Supabase session:', sessionError)
          throw new Error('Authentication session expired. Please refresh the page and try again.')
        }

        console.log('Using Supabase access token for RAG processing')

        // Call RAG processing endpoint with Supabase session token
        response = await fetch(`/api/clones/${cloneId}/process-knowledge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(ragRequest),
        })

        console.log(`Attempt ${attempt}: RAG processing response status:`, response.status, response.statusText)
        
        if (response.ok) {
          break; // Success, exit retry loop
        }
        
        // If it's a 404 (Clone not found) and we have more attempts, retry
        if (response.status === 404 && attempt < maxAttempts) {
          console.log(`Clone not found on attempt ${attempt}, retrying...`)
          continue;
        }
        
        // For other errors or if we've exhausted attempts, break and handle the error
        break;
      }

      console.log('Final RAG processing response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        let errorData;
        const responseText = await response.text()
        console.log('RAG processing error response text:', responseText)
        
        try {
          errorData = JSON.parse(responseText)
          
          // Enhanced error handling with user-friendly messages
          console.log('Parsed error data:', {
            error_type: errorData.error_type,
            retryable: errorData.retryable,
            attempts_made: errorData.attempts_made
          })
          
          // Handle specific error types with appropriate user feedback
          if (errorData.error_type === 'validation') {
            throw new Error(`Setup Issue: ${errorData.error}. Please refresh the page and try again.`)
          } else if (errorData.error_type === 'timeout') {
            throw new Error(`Processing Timeout: ${errorData.error}. You can check processing status later or retry.`)
          } else if (errorData.error_type === 'connection') {
            throw new Error(`Service Unavailable: ${errorData.error}. Please check your connection and try again.`)
          } else if (errorData.error_type === 'auth') {
            throw new Error(`Authentication Error: ${errorData.error}. Please refresh the page and log in again.`)
          } else {
            // Generic processing error with retryable info
            const retryMsg = errorData.retryable ? ' You can try processing again.' : ' Please contact support if this persists.'
            throw new Error(`Processing Error: ${errorData.error}${retryMsg}`)
          }
        } catch (parseError) {
          console.error('Failed to parse error response as JSON:', parseError)
          // Fallback error based on status code
          if (response.status >= 500) {
            throw new Error(`Service Temporarily Unavailable (${response.status}). Please try again in a few minutes.`)
          } else if (response.status === 401) {
            throw new Error('Authentication expired. Please refresh the page and log in again.')
          } else if (response.status === 404) {
            throw new Error('Clone not found. This might be a timing issue - please try again.')
          } else {
            throw new Error(`Processing failed (${response.status}). Please try again or contact support.`)
          }
        }
      }

      let result;
      const responseText = await response.text()
      console.log('RAG processing success response text:', responseText)
      
      try {
        result = JSON.parse(responseText)
        console.log('RAG processing result:', result)
      } catch (parseError) {
        console.error('Failed to parse success response as JSON:', parseError)
        throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`)
      }

      // Enhanced success handling with more detailed feedback
      if (result.overall_status === 'completed') {
        setKnowledgeProcessingStatus('completed')
        toast({
          title: "🎉 Knowledge Processing Complete!",
          description: result.message || `Successfully processed ${result.processed_count} documents. Your clone is ready for advanced conversations!`,
        })
        console.log(`RAG processing completed: ${result.processed_count} documents processed`)
      } else if (result.overall_status === 'failed') {
        setKnowledgeProcessingStatus('failed')
        toast({
          title: "Knowledge Processing Failed",
          description: result.message || "Documents couldn't be processed. Your clone will use basic conversation mode.",
          variant: "destructive",
        })
        if (result.processing_errors && result.processing_errors.length > 0) {
          console.log('Processing errors:', result.processing_errors)
        }
      } else if (result.overall_status === 'partial') {
        setKnowledgeProcessingStatus('partial')
        toast({
          title: "⚠️ Partial Processing Complete",
          description: result.message || `Processed ${result.processed_count} of ${result.total_entries} documents. Some failed but your clone has enhanced capabilities.`,
          variant: "destructive",
        })
        console.log(`Partial success: ${result.processed_count}/${result.total_entries} processed`)
      } else if (result.overall_status === 'timeout') {
        setKnowledgeProcessingStatus('partial')
        toast({
          title: "⏱️ Processing Taking Longer",
          description: result.message || "Processing is taking longer than expected. You can check status later or continue with setup.",
          variant: "destructive",
        })
      }

    } catch (error) {
      console.error('RAG processing error:', error)
      setKnowledgeProcessingStatus('failed')
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error'
      setProcessingProgress(prev => ({ 
        ...prev, 
        errors: [...prev.errors, errorMessage]
      }))
      
      // Enhanced error messaging with user-friendly guidance
      let toastTitle = "Knowledge Processing Failed"
      let toastDescription = "Your clone will use basic conversation mode."
      
      if (errorMessage.includes('Timeout')) {
        toastTitle = "⏱️ Processing Timeout"
        toastDescription = "Processing is taking longer than expected. You can retry later or continue with basic mode."
      } else if (errorMessage.includes('Authentication')) {
        toastTitle = "🔐 Authentication Issue"
        toastDescription = "Please refresh the page and log in again to retry processing."
      } else if (errorMessage.includes('Service Unavailable')) {
        toastTitle = "🔧 Service Temporarily Down"
        toastDescription = "Processing service is temporarily unavailable. Please try again in a few minutes."
      } else if (errorMessage.includes('Connection') || errorMessage.includes('Network')) {
        toastTitle = "🌐 Connection Issue"
        toastDescription = "Please check your internet connection and try again."
      }
      
      toast({
        title: toastTitle,
        description: toastDescription,
        variant: "destructive",
        action: errorMessage.includes('retry') || errorMessage.includes('retryable') ? {
          altText: "Retry Processing",
          label: "Retry",
          onClick: () => {
            console.log('User requested retry from toast')
            // Reset processing flags before retry
            setHasTriggeredProcessing(false)
            setLastProcessedCloneId(null)
            setProcessedDocuments(new Set())
            processKnowledgeWithRAG(cloneId)
          }
        } : undefined
      })
    } finally {
      setIsProcessingKnowledge(false)
      
      // Keep hasTriggeredProcessing true on completion to prevent re-processing
      // It will only be reset on navigation back or on error
    }
  }

  // Validation functions for each step
  const validateStep = (step: number): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    switch (step) {
      case 1: // Basic Information
        if (!formData.name.trim()) errors.push("Full Name is required")
        if (!formData.title.trim()) errors.push("Professional Title is required") 
        if (!formData.expertise.trim()) errors.push("Expertise Category is required")
        if (formData.expertise === "other" && !formData.customDomain.trim()) {
          errors.push("Custom Domain is required when 'Other' is selected")
        }
        if (!formData.bio.trim()) errors.push("Professional Bio is required")
        break
        
      case 2: // Q&A Training
        const answeredQuestions = Object.values(formData.qaResponses).filter(answer => answer.trim()).length
        if (answeredQuestions < 5) {
          errors.push("Please answer all 5 questions to train your clone effectively")
        }
        break
        
      case 3: // Knowledge Transfer - Optional step
        // This step is optional, always valid
        break
        
      case 4: // Personality & Style
        if (!formData.communicationStyle.trim()) errors.push("Communication Style is required")
        if (!formData.responseLength.trim()) errors.push("Response Length is required")
        break
        
      case 5: // Media Training - Optional
        // This step is optional, always valid
        break
        
      case 6: // Testing & Preview - No validation needed
        break
        
      case 7: // Pricing & Launch
        if (formData.pricing.text.min <= 0) errors.push("Text chat minimum price must be greater than 0")
        if (formData.pricing.voice.min <= 0) errors.push("Voice call minimum price must be greater than 0") 
        if (formData.pricing.video.min <= 0) errors.push("Video call minimum price must be greater than 0")
        if (formData.pricing.text.max < formData.pricing.text.min) errors.push("Text chat maximum price must be greater than minimum")
        if (formData.pricing.voice.max < formData.pricing.voice.min) errors.push("Voice call maximum price must be greater than minimum")
        if (formData.pricing.video.max < formData.pricing.video.min) errors.push("Video call maximum price must be greater than minimum")
        break
        
      default:
        break
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Save Q&A responses to the database
  const saveQAResponses = async (cloneId: string, qaResponses: Record<string, string>) => {
    try {
      const supabase = createClient()
      console.log('Saving Q&A responses for clone:', cloneId)
      console.log('Q&A data:', qaResponses)
      
      // Upsert Q&A data (insert or update if already exists)
      const { error } = await supabase
        .from('clone_qa_data')
        .upsert({
          clone_id: cloneId,
          qa_data: qaResponses,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'clone_id'
        })
      
      if (error) {
        console.error('Error saving Q&A responses:', error)
        throw error
      }
      
      console.log('Q&A responses saved successfully')
    } catch (error) {
      console.error('Failed to save Q&A responses:', error)
      throw error
    }
  }

  // Load Q&A responses from the database
  const loadQAResponses = async (cloneId: string): Promise<Record<string, string>> => {
    try {
      const supabase = createClient()
      console.log('Loading Q&A responses for clone:', cloneId)
      
      const { data, error } = await supabase
        .from('clone_qa_data')
        .select('qa_data')
        .eq('clone_id', cloneId)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No Q&A data found, return empty object
          console.log('No Q&A data found for clone')
          return {}
        }
        console.error('Error loading Q&A responses:', error)
        throw error
      }
      
      console.log('Loaded Q&A responses:', data?.qa_data)
      return data?.qa_data || {}
    } catch (error) {
      console.error('Failed to load Q&A responses:', error)
      return {}
    }
  }

  // Load existing knowledge documents and links for the clone
  const loadKnowledgeData = async (cloneId: string) => {
    try {
      const supabase = createClient()
      console.log('Loading knowledge data for clone:', cloneId)
      
      const { data: knowledgeData, error } = await supabase
        .from('knowledge')
        .select('*')
        .eq('clone_id', cloneId)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error loading knowledge data:', error)
        return { documents: [], links: [], processingStatus: 'pending' }
      }
      
      if (!knowledgeData || knowledgeData.length === 0) {
        console.log('No knowledge data found for clone')
        return { documents: [], links: [], processingStatus: 'pending' }
      }
      
      console.log('Loaded knowledge entries:', knowledgeData.length)
      
      const documents: Array<{name: string; url: string; status: string; type: string; id: string}> = []
      const links: Array<{name: string; url: string; status: string; type: string; id: string}> = []
      
      // Separate documents and links with robust null-safe mapping
      knowledgeData.forEach(item => {
        // Ensure we always have a valid name with robust null/undefined checking
        const safeName = (
          (item.title && typeof item.title === 'string' ? item.title.trim() : '') ||
          (item.file_name && typeof item.file_name === 'string' ? item.file_name.trim() : '') ||
          (item.name && typeof item.name === 'string' ? item.name.trim() : '') ||
          (item.file_url && typeof item.file_url === 'string' ? `Document-${item.id || Date.now()}` : '') ||
          (item.original_url && typeof item.original_url === 'string' ? `Link-${item.id || Date.now()}` : '') ||
          `Item-${item.id || Date.now()}`
        )
        
        // Ensure name is never empty, null, or undefined
        const finalName = (safeName && typeof safeName === 'string' && safeName.trim()) ? safeName.trim() : `Unknown-${item.id || Date.now()}`

        const itemData = {
          id: item.id || `knowledge-${Date.now()}`,
          name: finalName,
          url: item.file_url || item.original_url || '',
          status: item.vector_store_status || 'pending',
          type: item.content_type || 'unknown'
        }
        
        if (item.content_type === 'document' && item.file_url) {
          documents.push(itemData)
        } else if (item.content_type === 'link' && item.original_url) {
          try {
            const linkName = item.title || `Web Content: ${new URL(item.original_url).hostname}`
            links.push({
              ...itemData,
              url: item.original_url,
              name: linkName || `Link-${item.id}`
            })
          } catch (urlError) {
            console.warn('Error parsing URL for link name:', { url: item.original_url, error: urlError })
            links.push({
              ...itemData,
              url: item.original_url,
              name: item.title || `Link-${item.id}`
            })
          }
        }
      })
      
      // Determine overall processing status
      const allStatuses = knowledgeData.map(item => item.vector_store_status)
      let overallStatus = 'pending'
      
      if (allStatuses.length > 0) {
        if (allStatuses.every(status => status === 'completed')) {
          overallStatus = 'completed'
        } else if (allStatuses.some(status => status === 'processing')) {
          overallStatus = 'processing'
        } else if (allStatuses.some(status => status === 'failed')) {
          overallStatus = 'partial'
        }
      }
      
      console.log('Knowledge data processed:', {
        documents: documents.length,
        links: links.length,
        overallStatus,
        statuses: allStatuses
      })
      
      return {
        documents,
        links,
        processingStatus: overallStatus
      }
    } catch (error) {
      console.error('Error loading knowledge data:', error)
      return { documents: [], links: [], processingStatus: 'pending' }
    }
  }

  // Delete existing knowledge item (document or link)
  const deleteKnowledgeItem = async (itemId: string, itemType: 'document' | 'link') => {
    try {
      const supabase = createClient()
      console.log(`Deleting ${itemType} with ID:`, itemId)
      
      const { error } = await supabase
        .from('knowledge')
        .delete()
        .eq('id', itemId)
      
      if (error) {
        console.error(`Error deleting ${itemType}:`, error)
        toast({
          title: `Failed to delete ${itemType}`,
          description: "Please try again later",
          variant: "destructive",
        })
        return false
      }
      
      // Update form data to remove the deleted item
      if (itemType === 'document') {
        setFormData(prev => ({
          ...prev,
          existingDocuments: prev.existingDocuments?.filter(doc => doc.id !== itemId) || []
        }))
      } else {
        setFormData(prev => ({
          ...prev,
          existingLinks: prev.existingLinks?.filter(link => link.id !== itemId) || []
        }))
      }
      
      toast({
        title: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} deleted`,
        description: `The ${itemType} has been removed from your knowledge base`,
      })
      
      return true
    } catch (error) {
      console.error(`Error deleting ${itemType}:`, error)
      toast({
        title: `Failed to delete ${itemType}`,
        description: "Please try again later",
        variant: "destructive",
      })
      return false
    }
  }

  // Helper function to check if required tables exist and create them if missing
  const ensureTablesExist = async () => {
    try {
      const supabase = createClient()
      console.log('Checking if required database tables exist...')
      
      // Check if documents table exists by attempting a simple query
      const { data: documentsTest, error: documentsError } = await supabase
        .from('documents')
        .select('id')
        .limit(1)
      
      // Check if domains table exists
      const { data: domainsTest, error: domainsError } = await supabase
        .from('domains')
        .select('id')
        .limit(1)
      
      // Check if experts table exists
      const { data: expertsTest, error: expertsError } = await supabase
        .from('experts')
        .select('id')
        .limit(1)
      
      const missingTables = []
      if (documentsError) {
        console.error('Documents table issue:', documentsError.message)
        missingTables.push('documents')
      }
      if (domainsError) {
        console.error('Domains table issue:', domainsError.message)
        missingTables.push('domains')
      }
      if (expertsError) {
        console.error('Experts table issue:', expertsError.message)
        missingTables.push('experts')
      }
      
      if (missingTables.length > 0) {
        console.warn(`Missing tables: ${missingTables.join(', ')}`)
        toast({
          title: "Database Setup Required",
          description: `Missing database tables: ${missingTables.join(', ')}. Please contact support to run migrations.`,
          variant: "destructive"
        })
        return false
      }
      
      console.log('All required tables exist')
      return true
    } catch (error) {
      console.error('Error checking database tables:', error)
      return false
    }
  }

  // Upload file to Supabase Storage
  const uploadFile = async (file: File, bucket: string, folder: string): Promise<string | null> => {
    try {
      const supabase = createClient()
      // Ensure user is authenticated before upload
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('Session error:', sessionError)
        toast({
          title: "Authentication Error",
          description: "Please login again to upload files.",
          variant: "destructive"
        })
        return null
      }

      // Check if storage buckets exist, create them if needed
      const { allExist } = await checkStorageBuckets()
      if (!allExist) {
        console.log('Storage buckets missing, creating them...')
        const setupResult = await setupStorageBuckets()
        if (!setupResult.success) {
          console.error('Failed to setup storage buckets:', setupResult.error)
          toast({
            title: "Storage Setup Error",
            description: "Failed to setup file storage. Please contact support.",
            variant: "destructive"
          })
          return null
        }
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      // Include user ID in path for RLS policy compatibility
      const userId = user?.id || session?.user?.id || 'anonymous'
      const filePath = `${userId}/${folder}/${fileName}`

      // Debug: Log authentication and upload details
      console.log('Upload attempt details:', {
        bucket,
        filePath,
        userId,
        hasSession: !!session,
        hasUser: !!user,
        sessionUserId: session?.user?.id,
        contextUserId: user?.id,
        fileSize: file.size,
        fileType: file.type
      })

      // Upload with upsert to handle overwriting
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true })

      if (error) {
        console.error('Upload error details:', {
          error: error.message,
          errorCode: error.statusCode,
          bucket,
          filePath,
          hasAuth: !!session?.user?.id
        })
        
        // If bucket still doesn't exist, try to create it once more
        if (error.message.includes('Bucket not found')) {
          console.log('Bucket not found, attempting to create it...')
          await setupStorageBuckets()
          
          // Retry the upload
          const { data: retryData, error: retryError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, { upsert: true })
          
          if (retryError) {
            console.error('Retry upload error:', retryError)
            return null
          }
        } else {
          return null
        }
      }

      // Get public URL - this should work for public buckets
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

      console.log('Uploaded file to path:', filePath)
      console.log('Generated public URL:', urlData.publicUrl)
      
      // Clean up URL by removing trailing query parameters that might cause issues
      let cleanUrl = urlData.publicUrl
      if (cleanUrl.endsWith('?')) {
        cleanUrl = cleanUrl.slice(0, -1)
        console.log('Cleaned URL (removed trailing ?):', cleanUrl)
      }
      
      return cleanUrl
    } catch (error) {
      console.error('Upload error:', error)
      return null
    }
  }

  // Handle photo upload
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      })
      return
    }

    setFormData({ ...formData, photo: file })
    
    toast({
      title: "Photo selected",
      description: "Photo will be uploaded when you save progress",
    })
  }

  const handleNext = async () => {
    // Prevent rapid navigation clicks
    if (isNavigating || isSubmitting) {
      console.log('⚠️ Navigation already in progress, ignoring click')
      return
    }
    
    setIsNavigating(true)
    
    console.log('▶️ DEBUG: handleNext called:', {
      currentStep,
      documentsInFormData: formData.documents.length,
      linksInFormData: formData.links.length,
      documents: formData.documents.map(doc => ({ name: doc.name, size: doc.size }))
    })

    try {
      // Validate current step before proceeding
      const validation = validateStep(currentStep)
      
      if (!validation.isValid) {
        toast({
          title: "Please complete required fields",
          description: validation.errors.join(". "),
          variant: "destructive",
        })
        return
      }
    
    if (currentStep < steps.length) {
      console.log('💾 DEBUG: Before saveProgress:', {
        documentsCount: formData.documents.length,
        documents: formData.documents.map(doc => ({ name: doc.name, size: doc.size }))
      })

      // Save progress before moving to next step
      const currentCloneId = await saveProgress()
      
      console.log('💾 DEBUG: After saveProgress:', {
        documentsCount: formData.documents.length,
        documents: formData.documents.map(doc => ({ name: doc.name, size: doc.size })),
        currentCloneId
      })
      
      // Ensure clone was created before processing knowledge
      if (!currentCloneId) {
        console.error('Clone ID not available after saveProgress()')
        toast({
          title: "Setup Error",
          description: "Please complete the basic information first and try again.",
          variant: "destructive"
        })
        return
      }
      
      // Special handling for Step 3 (Knowledge Transfer) - trigger RAG processing
      const hasDocumentsOrLinks = formData.documents.length > 0 || formData.links.length > 0
      const hasExistingContent = (formData.existingDocuments && formData.existingDocuments.length > 0) || 
                                (formData.existingLinks && formData.existingLinks.length > 0)
      const shouldTriggerProcessing = currentStep === 3 && hasDocumentsOrLinks && 
        !hasTriggeredProcessing && !isProcessingKnowledge && 
        currentCloneId !== lastProcessedCloneId && !hasExistingContent
      
      console.log('🎯 DEBUG: Checking if should trigger RAG processing:', {
        currentStep,
        documentsLength: formData.documents.length,
        linksLength: formData.links.length,
        existingDocumentsLength: formData.existingDocuments?.length || 0,
        existingLinksLength: formData.existingLinks?.length || 0,
        documents: formData.documents.map(doc => ({ name: doc.name, size: doc.size })),
        links: formData.links,
        hasDocumentsOrLinks,
        hasExistingContent,
        hasTriggeredProcessing,
        isProcessingKnowledge,
        currentCloneId,
        lastProcessedCloneId,
        shouldTrigger: shouldTriggerProcessing
      })
      
      if (shouldTriggerProcessing) {
        try {
          // Give extra time for database consistency after clone creation/update
          console.log('Waiting extra time for database consistency after saveProgress...')
          await new Promise(resolve => setTimeout(resolve, 3000))

          // Use the enhanced verification function
          const cloneExists = await verifyCloneExists(currentCloneId, 5)
          
          if (!cloneExists) {
            toast({
              title: "Clone verification failed",
              description: "Please try saving the clone again or refresh the page.",
              variant: "destructive"
            })
            return
          }
          
          // Mark as triggered to prevent duplicate processing
          setHasTriggeredProcessing(true)
          setLastProcessedCloneId(currentCloneId)
          
          // Process knowledge in background - don't block navigation
          processKnowledgeWithRAG(currentCloneId).catch(error => {
            console.error('Background RAG processing failed:', error)
            // Reset flags on error to allow retry
            setHasTriggeredProcessing(false)
            setLastProcessedCloneId(null)
          })
          
          toast({
            title: "Processing Knowledge in Background",
            description: "Your documents are being processed. You can continue with the setup.",
          })
        } catch (error) {
          console.error('Failed to start RAG processing:', error)
          // Reset flags on error to allow retry
          setHasTriggeredProcessing(false)
          setLastProcessedCloneId(null)
          toast({
            title: "Processing Warning",
            description: "Could not start knowledge processing, but you can continue with setup.",
            variant: "destructive",
          })
        }
      }
      
      setCurrentStep(currentStep + 1)
    }
    } finally {
      // Reset navigation flag after a short delay
      setTimeout(() => {
        setIsNavigating(false)
      }, 500)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      
      // Clear processing flags when navigating away from step 3
      if (currentStep === 4) {
        console.log('🔄 DEBUG: Navigating back from step 4, clearing processing flags')
        setHasTriggeredProcessing(false)
      }
    }
  }

  const saveProgress = async (): Promise<string | null> => {
    try {
      const supabase = createClient()
      setIsSubmitting(true)
      
      // Check if we already have a clone ID and if it exists in the database
      if (createdCloneId) {
        console.log('Checking if existing clone still exists:', createdCloneId)
        
        const { data: existingClone, error: checkError } = await supabase
          .from('clones')
          .select('id, name, creator_id')
          .eq('id', createdCloneId)
          .eq('creator_id', user?.id)
          .single()
          
        if (checkError || !existingClone) {
          console.warn('Existing clone not found, will create new one:', checkError?.message)
          setCreatedCloneId(null)
        } else {
          console.log('Existing clone found, will update it:', existingClone)
        }
      }
      
      // Upload photo if exists
      let avatarUrl = null
      if (formData.photo) {
        console.log('Uploading avatar photo...')
        avatarUrl = await uploadFile(formData.photo, 'clone-avatars', 'avatars')
        if (!avatarUrl) {
          toast({
            title: "Photo upload failed",
            description: "Continuing without photo upload",
            variant: "destructive",
          })
        } else {
          console.log('Avatar uploaded successfully to:', avatarUrl)
        }
      }
      
      if (!createdCloneId) {
        // Create initial clone with validation
        if (!formData.name?.trim()) {
          throw new Error('Clone name is required before saving')
        }
        
        const cloneData: CloneCreateRequest = {
          name: formData.name.trim(),
          category: formData.expertise === 'other' ? formData.customDomain || 'Other' : formData.expertise || 'coaching',
          expertise_areas: [],
          base_price: formData.pricing.text.min || 25,
          bio: formData.bio,
          personality_traits: formData.personality,
          communication_style: {
            style: formData.communicationStyle,
            response_length: formData.responseLength,
          },
          languages: formData.languages,
        }

        // Create clone directly in Supabase
        const supabaseCloneData = {
          creator_id: user?.id,
          name: cloneData.name,
          professional_title: formData.title,
          bio: cloneData.bio,
          credentials_qualifications: formData.credentials.trim() || null,
          avatar_url: avatarUrl || formData.existingAvatarUrl || null,
          category: cloneData.category,
          expertise_areas: [],
          languages: cloneData.languages.length > 0 ? cloneData.languages : ['English'],
          base_price: cloneData.base_price,
          personality_traits: cloneData.personality_traits,
          communication_style: cloneData.communication_style,
          is_published: false,
          is_active: true,
        }

        console.log('Creating clone with data:', supabaseCloneData)
        console.log('Credentials being saved:', formData.credentials)
        console.log('Credentials trimmed:', formData.credentials.trim())
        console.log('Avatar URL being saved:', avatarUrl || formData.existingAvatarUrl)
        
        // Check for potential duplicates before creating
        const { data: existingClones, error: duplicateCheckError } = await supabase
          .from('clones')
          .select('id, name')
          .eq('creator_id', user?.id)
          .eq('name', supabaseCloneData.name)
          .limit(1)
          
        if (!duplicateCheckError && existingClones && existingClones.length > 0) {
          console.warn('Clone with same name already exists:', existingClones[0])
          // Use the existing clone instead of creating a duplicate
          setCreatedCloneId(existingClones[0].id)
          
          toast({
            title: "Existing clone found",
            description: `Continuing with existing clone: ${existingClones[0].name}`,
          })
          
          return existingClones[0].id
        }

        const { data: clone, error } = await supabase
          .from('clones')
          .insert([supabaseCloneData])
          .select()
          .single()
        
        if (error) {
          console.error('Supabase clone creation error:', error)
          throw new Error(`Failed to create clone: ${error.message}`)
        }
        
        if (clone) {
          setCreatedCloneId(clone.id)
          
          // Wait for database consistency before proceeding
          console.log('Waiting for database consistency after clone creation...')
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Verify the clone was actually created
          const verificationSuccess = await verifyCloneExists(clone.id, 3)
          if (!verificationSuccess) {
            console.error('Clone creation verification failed')
            throw new Error('Clone was created but verification failed. Please try again.')
          }
          
          // Update formData with the new avatar URL if uploaded
          if (avatarUrl) {
            console.log('Updating formData with new avatar URL:', avatarUrl)
            setFormData(prev => ({
              ...prev,
              photo: null, // Clear the file object
              existingAvatarUrl: avatarUrl // Set the uploaded URL
            }))
          }
          
          // Save Q&A data if there are responses
          if (Object.keys(formData.qaResponses).length > 0) {
            await saveQAResponses(clone.id, formData.qaResponses)
          }
          
          toast({
            title: "Progress saved",
            description: "Clone created and progress saved",
          })
          
          return clone.id  // Return the new clone ID
        }
      } else {
        // Update existing clone
        const updateData = {
          name: formData.name,
          expertise_areas: [],
          base_price: formData.pricing.text.min,
          bio: formData.bio,
          personality_traits: formData.personality,
          communication_style: {
            style: formData.communicationStyle,
            response_length: formData.responseLength,
          },
          languages: formData.languages,
        }

        // Update clone directly in Supabase with validation
        if (!updateData.name?.trim()) {
          throw new Error('Clone name is required before updating')
        }
        
        const supabaseUpdateData = {
          name: updateData.name.trim(),
          professional_title: formData.title,
          bio: updateData.bio,
          credentials_qualifications: formData.credentials.trim() || null,
          avatar_url: avatarUrl || formData.existingAvatarUrl || null,
          category: formData.expertise === 'other' ? formData.customDomain || 'Other' : formData.expertise || 'coaching',
          expertise_areas: [],
          languages: updateData.languages.length > 0 ? updateData.languages : ['English'],
          base_price: updateData.base_price,
          personality_traits: updateData.personality_traits,
          communication_style: updateData.communication_style,
          updated_at: new Date().toISOString(),
        }
        
        console.log('Updating clone with data:', supabaseUpdateData)
        console.log('Credentials being updated:', formData.credentials)
        console.log('Credentials trimmed:', formData.credentials.trim())
        console.log('Avatar URL being updated:', avatarUrl || formData.existingAvatarUrl)
        
        const { error } = await supabase
          .from('clones')
          .update(supabaseUpdateData)
          .eq('id', createdCloneId)
          .eq('creator_id', user?.id) // Additional security check
        
        if (error) {
          console.error('Supabase clone update error:', error)
          throw new Error(`Failed to update clone: ${error.message}`)
        }
        
        // Update formData with the new avatar URL if uploaded
        if (avatarUrl) {
          console.log('Updating formData with new avatar URL:', avatarUrl)
          setFormData(prev => ({
            ...prev,
            photo: null, // Clear the file object
            existingAvatarUrl: avatarUrl // Set the uploaded URL
          }))
        }
        
        // Save Q&A data if there are responses
        if (Object.keys(formData.qaResponses).length > 0) {
          await saveQAResponses(createdCloneId, formData.qaResponses)
        }
        
        toast({
          title: "Progress saved",
          description: "Clone updated successfully",
        })
        
        return createdCloneId  // Return existing clone ID
      }
      
      return null  // No clone ID available
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save progress",
        variant: "destructive",
      })
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFinalSubmit = async () => {
    try {
      const supabase = createClient()
      setIsSubmitting(true)
      
      if (!createdCloneId) {
        await saveProgress()
        if (!createdCloneId) return
      }

      // Process Q&A responses into knowledge entries
      const qaPromises = Object.entries(formData.qaResponses)
        .filter(([_, answer]) => answer && answer.trim())
        .map(([question, answer]) =>
          createKnowledgeEntry({
            clone_id: createdCloneId!,
            question,
            answer,
            category: 'qa_training',
            confidence: 0.9,
          })
        )

      await Promise.all(qaPromises)

      // Documents and URLs are now processed in the knowledge transfer step (step 3)
      // This avoids duplicate storage and ensures they're available for RAG processing immediately
      console.log('Document processing handled in knowledge transfer step')

      toast({
        title: "Clone created successfully!",
        description: formData.status === 'published' ? 
          "Your clone is now live and available to users" : 
          "Your clone has been saved as a draft",
      })

      // Redirect to dashboard
      router.push('/dashboard/creator')
      
    } catch (error) {
      console.error('Submit error:', error)
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Failed to create clone",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }


  const addLanguage = () => {
    if (newLanguage.trim()) {
      setFormData({
        ...formData,
        languages: [...formData.languages, newLanguage.trim()],
      })
      setNewLanguage("")
    }
  }

  const removeLanguage = (index: number) => {
    setFormData({
      ...formData,
      languages: formData.languages.filter((_, i) => i !== index),
    })
  }

  const addLink = () => {
    if (newLink.trim()) {
      setFormData({
        ...formData,
        links: [...formData.links, newLink.trim()],
      })
      setNewLink("")
    }
  }

  const removeLink = (index: number) => {
    setFormData({
      ...formData,
      links: formData.links.filter((_, i) => i !== index),
    })
  }

  // Audio recording functions
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const audioChunks: BlobPart[] = []

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        await processAudioMessage(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting audio recording:', error)
      alert('Could not access microphone. Please check permissions.')
    }
  }

  const stopAudioRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      setIsRecording(false)
      setMediaRecorder(null)
    }
  }

  const processAudioMessage = async (audioBlob: Blob) => {
    // For now, we'll simulate speech-to-text conversion
    // In a real implementation, you'd send the audio to a speech-to-text service
    const transcriptText = "Audio message received - processing..."
    
    const userMessage = {
      id: Date.now().toString(),
      content: `🎤 ${transcriptText}`,
      sender: "user" as "user" | "clone",
      timestamp: new Date(),
    }

    setTestMessages(prev => [...prev, userMessage])
    
    // Process the transcribed text through the same AI flow
    await processTextMessage(transcriptText)
  }

  const processTextMessage = async (text: string) => {
    // Show typing indicator
    const typingMessage = {
      id: "typing",
      content: "Typing...",
      sender: "clone" as "user" | "clone",
      timestamp: new Date(),
    }
    
    setTestMessages(prev => [...prev, typingMessage])

    try {
      // Get AI response using OpenAI
      const aiResponse = await testCloneWithAI(text)
      
      // Remove typing indicator and add real response
      setTestMessages(prev => {
        const withoutTyping = prev.filter(msg => msg.id !== "typing")
        const cloneMessage = {
          id: (Date.now() + 1).toString(),
          content: aiResponse || "I'm sorry, I'm having trouble processing that right now. Could you try rephrasing your question?",
          sender: "clone" as "user" | "clone",
          timestamp: new Date(),
        }
        return [...withoutTyping, cloneMessage]
      })
    } catch (error) {
      console.error('Error getting AI response:', error)
      
      // Remove typing indicator and show error message
      setTestMessages(prev => {
        const withoutTyping = prev.filter(msg => msg.id !== "typing")
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          content: "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment.",
          sender: "clone" as "user" | "clone",
          timestamp: new Date(),
        }
        return [...withoutTyping, errorMessage]
      })
    }
  }

  const handleTestMessage = async () => {
    if (!testInput.trim()) return

    const userMessage = {
      id: Date.now().toString(),
      content: testInput,
      sender: "user" as "user" | "clone",
      timestamp: new Date(),
    }

    setTestMessages(prev => [...prev, userMessage])
    setTestInput("")

    await processTextMessage(userMessage.content)
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Dr. Sarah Chen"
                  />
                </div>

                <div>
                  <Label htmlFor="title">Professional Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Life Coach & Therapist"
                  />
                </div>

                <div>
                  <Label htmlFor="expertise">Expertise Category *</Label>
                  <Select
                    value={formData.expertise}
                    onValueChange={(value) => setFormData({ ...formData, expertise: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your expertise area" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(expertTypes).map(([key, type]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center space-x-2">
                            <type.icon className="h-4 w-4" />
                            <span>{type.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.expertise === "other" && (
                  <div>
                    <Label htmlFor="customDomain">Custom Domain *</Label>
                    <Input
                      id="customDomain"
                      placeholder="Enter your expertise domain (e.g., Digital Marketing, Cybersecurity, etc.)"
                      value={formData.customDomain}
                      onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="photo">Profile Photo</Label>
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage 
                        src={
                          formData.photo 
                            ? URL.createObjectURL(formData.photo) 
                            : (formData.existingAvatarUrl && formData.existingAvatarUrl.trim() !== "") 
                              ? formData.existingAvatarUrl 
                              : "/placeholder.svg"
                        }
                        onError={(e) => {
                          console.error('Avatar image failed to load:', e.currentTarget.src)
                          console.log('formData.photo:', !!formData.photo)
                          console.log('formData.existingAvatarUrl:', formData.existingAvatarUrl)
                        }}
                        onLoad={() => {
                          console.log('Avatar image loaded successfully:', formData.existingAvatarUrl)
                        }}
                      />
                      <AvatarFallback>
                        {formData.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <input
                        type="file"
                        id="photo-upload"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        className="bg-transparent"
                        onClick={() => document.getElementById('photo-upload')?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Photo
                      </Button>
                      {formData.photo && (
                        <p className="text-xs text-green-600 mt-1">Photo selected: {formData.photo.name}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="bio">Professional Bio *</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Describe your background, experience, and approach..."
                    rows={4}
                  />
                </div>

              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="credentials">Credentials & Qualifications</Label>
                <Textarea
                  id="credentials"
                  value={formData.credentials}
                  onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                  placeholder="&#10;Example:&#10;PhD Psychology - Stanford University&#10;Licensed Clinical Therapist&#10;10+ years experience in cognitive behavioral therapy"
                  rows={4}
                />
              </div>

              <div>
                <Label>Languages</Label>
                <div className="mb-2">
                  <Select
                    value=""
                    onValueChange={(language) => {
                      if (language && !formData.languages.includes(language)) {
                        setFormData({
                          ...formData,
                          languages: [...formData.languages, language]
                        })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select languages to add..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLanguages
                        .filter(lang => !formData.languages.includes(lang))
                        .map((language) => (
                        <SelectItem key={language} value={language}>
                          {language}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.languages.map((language, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                      <span>{language}</span>
                      <button onClick={() => removeLanguage(index)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )

      case 2:
        const answeredCount = Object.values(formData.qaResponses).filter(answer => answer.trim()).length
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageCircle className="h-5 w-5" />
                    <span>Q&A Training</span>
                  </div>
                  <div className="text-sm">
                    <span className={answeredCount === 5 ? "text-green-600" : "text-orange-600"}>
                      {answeredCount}/5 questions answered
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="text-slate-600 dark:text-slate-300">
                    Answer all 5 questions to train your AI clone's responses. These questions are designed to capture your expertise across all domains. The more detailed and specific your answers, the better your clone will perform.
                  </p>
                  {answeredCount < 5 && (
                    <p className="text-orange-600 text-sm mt-2">
                      ⚠️ Please answer the remaining {5 - answeredCount} question{5 - answeredCount !== 1 ? 's' : ''} to continue.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {universalQuestions.map((questionObj, index) => (
                    <div key={questionObj.id} className="space-y-3 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <Label className="text-sm font-medium text-slate-900 dark:text-white">
                        {index + 1}. {questionObj.question}
                      </Label>
                      <Textarea
                        value={formData.qaResponses[questionObj.question] || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            qaResponses: {
                              ...formData.qaResponses,
                              [questionObj.question]: e.target.value,
                            },
                          })
                        }
                        placeholder={questionObj.placeholder}
                        rows={4}
                        className="resize-none min-h-[100px]"
                      />
                      <div className="text-xs text-slate-500">
                        {formData.qaResponses[questionObj.question]?.length || 0} characters
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Tips for better responses:</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Be specific and include real examples from your experience</li>
                    <li>• Use your natural voice and communication style</li>
                    <li>• Include your unique methodologies and approaches</li>
                    <li>• Mention any tools, frameworks, or techniques you use</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            {/* Knowledge Transfer Status Summary */}
            {(formData.existingDocuments?.length > 0 || formData.existingLinks?.length > 0) ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <h3 className="font-medium text-blue-900 dark:text-blue-100">Knowledge Base Loaded</h3>
                </div>
                <p className="text-blue-800 dark:text-blue-200 text-sm mb-2">
                  Found {formData.existingDocuments?.length || 0} documents and {formData.existingLinks?.length || 0} links from your previous setup.
                </p>
                {knowledgeProcessingStatus === 'completed' && (
                  <p className="text-green-700 dark:text-green-300 text-sm font-medium">
                    ✅ Knowledge processing completed - your clone has enhanced conversation capabilities.
                  </p>
                )}
                {knowledgeProcessingStatus === 'processing' && (
                  <p className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                    ⏳ Knowledge processing in progress - this will enhance your clone's responses.
                  </p>
                )}
                {knowledgeProcessingStatus === 'partial' && (
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm font-medium">
                    ⚠️ Some knowledge processed successfully - your clone has partial enhanced capabilities.
                  </p>
                )}
                {knowledgeProcessingStatus === 'failed' && (
                  <p className="text-red-700 dark:text-red-300 text-sm font-medium">
                    ❌ Knowledge processing failed - your clone will use basic conversation mode.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <p className="text-green-800 dark:text-green-200 text-sm">
                  ✅ This step is optional. You can skip this section and add knowledge materials later, or proceed to the next step.
                </p>
              </div>
            )}
            <Tabs defaultValue="documents" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="links">Links & URLs</TabsTrigger>
              </TabsList>

              <TabsContent value="documents" className="space-y-4">
                {/* Enhanced Document Upload with Duplicate Detection */}
                {createdCloneId ? (
                  <EnhancedDocumentUpload
                    cloneId={createdCloneId}
                    onDocumentUploaded={(document) => {
                      console.log('Document uploaded successfully:', document)
                      // Add the uploaded document to formData for processing
                      setFormData(prev => ({
                        ...prev,
                        existingDocuments: [
                          ...(prev.existingDocuments || []),
                          {
                            id: document.id || `doc-${Date.now()}`,
                            name: document.filename || document.file_name || document.title || document.name || `Document-${Date.now()}`,
                            url: document.upload_url || document.file_url || document.url || '',
                            status: document.processing_status || document.vector_store_status || document.status || 'pending',
                            type: document.type || 'document'
                          }
                        ]
                      }))
                      
                      toast({
                        title: "Document uploaded",
                        description: `${document.filename || document.file_name || document.title || 'Document'} has been added to your knowledge base`,
                      })
                    }}
                    existingDocuments={formData.existingDocuments}
                    maxFileSize={10}
                    allowedExtensions={['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf']}
                  />
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                        Complete Basic Information First
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 mb-4">
                        Please fill out the basic information in Step 1 to enable document upload with duplicate detection.
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={() => setCurrentStep(1)}
                        className="bg-transparent"
                      >
                        Go to Basic Information
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Legacy file input for compatibility - kept but hidden */}
                {false && formData.documents.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Legacy Document Queue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {formData.documents.map((doc, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          >
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-slate-500" />
                              <span className="text-sm">{doc.name}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  documents: formData.documents.filter((_, i) => i !== index)
                                })
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="links" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <LinkIcon className="h-5 w-5" />
                      <span>Add Links & URLs</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Show existing links if any */}
                    {formData.existingLinks && formData.existingLinks.length > 0 && (
                      <div className="mb-6">
                        <Label className="text-base font-medium">Existing Links</Label>
                        <div className="mt-2 space-y-2">
                          {formData.existingLinks.map((linkData, index) => (
                            <div
                              key={`existing-link-${linkData.id}`}
                              className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border"
                            >
                              <div className="flex items-center space-x-3">
                                <LinkIcon className="h-4 w-4 text-blue-600" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium block truncate">{linkData.name}</span>
                                  <span className="text-xs text-gray-500 block truncate">{linkData.url}</span>
                                  <div className="flex items-center space-x-2 mt-1">
                                    {linkData.status === 'completed' && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Processed
                                      </span>
                                    )}
                                    {linkData.status === 'processing' && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                        Processing
                                      </span>
                                    )}
                                    {linkData.status === 'failed' && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                                        <X className="h-3 w-3 mr-1" />
                                        Failed
                                      </span>
                                    )}
                                    {linkData.status === 'pending' && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(linkData.url, '_blank')}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  Visit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteKnowledgeItem(linkData.id, 'link')}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <Input
                        value={newLink}
                        onChange={(e) => setNewLink(e.target.value)}
                        placeholder={formData.existingLinks && formData.existingLinks.length > 0 ? "Add another link..." : "https://example.com/your-content"}
                        onKeyPress={(e) => e.key === "Enter" && addLink()}
                      />
                      <Button onClick={addLink} variant="outline" className="bg-transparent">
                        Add Link
                      </Button>
                    </div>

                    {formData.links.length > 0 && (
                      <div className="space-y-2">
                        {formData.links.map((link, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          >
                            <div className="flex items-center space-x-2">
                              <LinkIcon className="h-4 w-4 text-slate-500" />
                              <span className="text-sm truncate">{link}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeLink(index)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Enhanced RAG Processing Status - Hidden (RAG functionality removed) */}
            {false && (formData.documents.length > 0 || formData.links.length > 0 || 
              (formData.existingDocuments && formData.existingDocuments.length > 0) ||
              (formData.existingLinks && formData.existingLinks.length > 0)) && (
              <div className="mt-6">
                <EnhancedProcessingMonitor
                  cloneId={createdCloneId || undefined}
                  status={knowledgeProcessingStatus as 'pending' | 'processing' | 'completed' | 'failed' | 'partial'}
                  processedCount={processingProgress.completed}
                  totalCount={
                    processingProgress.total || 
                    (formData.documents.length + formData.links.length) ||
                    ((formData.existingDocuments?.length || 0) + (formData.existingLinks?.length || 0))
                  }
                  failedCount={processingProgress.errors.length}
                  errors={processingProgress.errors}
                  onRetry={createdCloneId ? () => retryKnowledgeProcessing(createdCloneId) : undefined}
                  showHealthCheck={knowledgeProcessingStatus === 'failed'}
                  isRetrying={isProcessingKnowledge && retryCount > 0}
                  retryCount={retryCount}
                />
              </div>
            )}

            {/* Legacy RAG Processing Status - Hidden */}
            {false && (formData.documents.length > 0 || formData.links.length > 0) && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <span>Knowledge Processing Status</span>
                    {isProcessingKnowledge && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Status Message */}
                    <div className="flex items-center space-x-2">
                      {knowledgeProcessingStatus === 'pending' && (
                        <>
                          <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            Ready to process when you click "Next"
                          </span>
                        </>
                      )}
                      {knowledgeProcessingStatus === 'processing' && (
                        <>
                          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="text-sm text-blue-600 dark:text-blue-300">
                            Processing your documents and links...
                          </span>
                        </>
                      )}
                      {knowledgeProcessingStatus === 'completed' && (
                        <>
                          <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-green-600 dark:text-green-300">
                            Knowledge processing completed successfully!
                          </span>
                        </>
                      )}
                      {knowledgeProcessingStatus === 'failed' && (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 bg-red-500 rounded-full"></div>
                            <span className="text-sm text-red-600 dark:text-red-300">
                              Processing failed. You can retry now or continue.
                            </span>
                          </div>
                          {createdCloneId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryKnowledgeProcessing(createdCloneId)}
                              disabled={isProcessingKnowledge}
                              className="ml-2 flex-shrink-0"
                            >
                              {isProcessingKnowledge ? 'Retrying...' : 'Retry'}
                            </Button>
                          )}
                        </div>
                      )}
                      {knowledgeProcessingStatus === 'partial' && (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm text-yellow-600 dark:text-yellow-300">
                              Some documents processed successfully.
                            </span>
                          </div>
                          {createdCloneId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryKnowledgeProcessing(createdCloneId)}
                              disabled={isProcessingKnowledge}
                              className="ml-2 flex-shrink-0"
                            >
                              {isProcessingKnowledge ? 'Retrying...' : 'Retry Failed'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Progress Bar (only during processing) */}
                    {isProcessingKnowledge && processingProgress.total > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{processingProgress.completed}/{processingProgress.total}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(processingProgress.completed / processingProgress.total) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Error Messages */}
                    {processingProgress.errors.length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Processing Errors:</p>
                        <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                          {processingProgress.errors.map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Processing Info */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>What happens during processing:</strong>
                      </p>
                      <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                        <li>• Documents are uploaded and analyzed</li>
                        <li>• Content is processed using advanced AI</li>
                        <li>• Knowledge is integrated into your clone's expertise</li>
                        <li>• You can continue setup while processing runs in background</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personality Traits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {personalityTraits.map((trait) => (
                  <div key={trait.key} className="space-y-3">
                    <Label className="text-sm font-medium">{trait.label}</Label>
                    <div className="px-3">
                      <Slider
                        value={formData.personality[trait.key as keyof typeof formData.personality]}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            personality: {
                              ...formData.personality,
                              [trait.key]: value,
                            },
                          })
                        }
                        max={100}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{trait.min}</span>
                      <span>{trait.max}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Communication Style</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={formData.communicationStyle}
                    onValueChange={(value) => setFormData({ ...formData, communicationStyle: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="empathetic">Empathetic</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Response Length</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={formData.responseLength}
                    onValueChange={(value) => setFormData({ ...formData, responseLength: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short & Concise</SelectItem>
                      <SelectItem value="medium">Medium Length</SelectItem>
                      <SelectItem value="detailed">Detailed & Comprehensive</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <p className="text-green-800 dark:text-green-200 text-sm">
                ✅ This step is optional. Voice and video training can enhance your clone's capabilities, but you can skip this and add media training later.
              </p>
            </div>
            
            {/* Toggle Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Media Training Options</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Choose which media types you want to train your clone with
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Mic className="h-5 w-5 text-slate-600" />
                    <div>
                      <p className="font-medium">Audio Training</p>
                      <p className="text-sm text-slate-500">Train your clone's voice</p>
                    </div>
                  </div>
                  <Button
                    variant={formData.enableAudio ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      console.log('Audio toggle clicked, current state:', formData.enableAudio)
                      setFormData({...formData, enableAudio: !formData.enableAudio})
                    }}
                  >
                    {formData.enableAudio ? "Enabled" : "Enable"}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Video className="h-5 w-5 text-slate-600" />
                    <div>
                      <p className="font-medium">Video Training</p>
                      <p className="text-sm text-slate-500">Train your clone's appearance</p>
                    </div>
                  </div>
                  <Button
                    variant={formData.enableVideo ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      console.log('Video toggle clicked, current state:', formData.enableVideo)
                      setFormData({...formData, enableVideo: !formData.enableVideo})
                    }}
                  >
                    {formData.enableVideo ? "Enabled" : "Enable"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Conditional Media Training Sections */}
            <div className={`grid gap-6 ${formData.enableAudio && formData.enableVideo ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              {console.log('Rendering conditional sections - Audio:', formData.enableAudio, 'Video:', formData.enableVideo)}
              {/* Audio Training - Only show if enabled */}
              {formData.enableAudio && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Mic className="h-5 w-5" />
                      <span>Voice Training</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Upload a 2-3 minute audio sample to train your clone's voice
                    </p>
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center">
                      <Mic className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium mb-2">Record or Upload Audio</p>
                      <div className="flex space-x-2 justify-center">
                        <Button variant="outline" size="sm" className="bg-transparent">
                          Record
                        </Button>
                        <Button variant="outline" size="sm" className="bg-transparent">
                          Upload File
                        </Button>
                      </div>
                    </div>
                    {formData.audioSample && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Mic className="h-4 w-4 text-slate-500" />
                          <span className="text-sm">{formData.audioSample.name}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Video Training - Only show if enabled */}
              {formData.enableVideo && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Video className="h-5 w-5" />
                      <span>Video Training</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Upload a 2-3 minute video sample for avatar creation
                    </p>
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center">
                      <Video className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium mb-2">Record or Upload Video</p>
                      <div className="flex space-x-2 justify-center">
                        <Button variant="outline" size="sm" className="bg-transparent">
                          Record
                        </Button>
                        <Button variant="outline" size="sm" className="bg-transparent">
                          Upload File
                        </Button>
                      </div>
                    </div>
                    {formData.videoSample && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Video className="h-4 w-4 text-slate-500" />
                          <span className="text-sm">{formData.videoSample.name}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Media Training Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Audio Recording Tips:</h4>
                    <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                      <li>• Use a quiet environment</li>
                      <li>• Speak clearly and naturally</li>
                      <li>• Include various emotions and tones</li>
                      <li>• Read different types of content</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Video Recording Tips:</h4>
                    <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                      <li>• Good lighting on your face</li>
                      <li>• Look directly at the camera</li>
                      <li>• Use natural gestures and expressions</li>
                      <li>• Maintain consistent framing</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            {/* Clone Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="text-center">
                <CardContent className="pt-6">
                  <MessageCircle className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                  <h3 className="font-semibold text-sm">Chat Clone</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Text conversations</p>
                  <div className="mt-2">
                    <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                      Ready
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="pt-6">
                  <Mic className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                  <h3 className="font-semibold text-sm">Voice Clone</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Audio conversations</p>
                  <div className="mt-2">
                    <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
                      {formData.enableAudio ? "Ready" : "Not Enabled"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="pt-6">
                  <Video className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                  <h3 className="font-semibold text-sm">Video Clone</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Video conversations</p>
                  <div className="mt-2">
                    <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
                      {formData.enableVideo ? "Ready" : "Not Enabled"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Testing Interface */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Play className="h-5 w-5" />
                  <span>Clone Testing</span>
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  Test your AI clone with real conversations powered by GPT-5. Your clone will respond using your professional background, credentials, and training data.
                </p>
              </CardHeader>
              <CardContent>
                {isTestingClone ? (
                  <div className="space-y-4">
                    {/* Stop Testing Button */}
                    <div className="flex justify-end">
                      <Button
                        onClick={() => setIsTestingClone(false)}
                        variant="outline"
                        size="sm"
                      >
                        Stop Testing
                      </Button>
                    </div>
                    
                    {/* Chat Interface */}
                    <div className="h-96 border border-slate-200 dark:border-slate-700 rounded-lg p-4 overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
                      <div className="space-y-4">
                        {testMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                message.sender === "user"
                                  ? "bg-blue-500 text-white"
                                  : message.id === "typing"
                                  ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 animate-pulse"
                                  : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <p className="text-sm">{message.content}</p>
                              {message.sender === "clone" && message.id !== "typing" && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {formData.name} • Powered by GPT-5
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Testing Mode Selection */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                      <div className="flex space-x-2 mb-4">
                        <Button
                          size="sm"
                          variant={testingMode === 'text' ? 'default' : 'outline'}
                          onClick={() => setTestingMode('text')}
                        >
                          💬 Text
                        </Button>
                        {formData.enableAudio && (
                          <Button
                            size="sm"
                            variant={testingMode === 'audio' ? 'default' : 'outline'}
                            onClick={() => setTestingMode('audio')}
                          >
                            <Mic className="h-4 w-4 mr-1" />
                            Audio
                          </Button>
                        )}
                        {formData.enableVideo && (
                          <Button
                            size="sm"
                            variant={testingMode === 'video' ? 'default' : 'outline'}
                            onClick={() => setTestingMode('video')}
                          >
                            <Video className="h-4 w-4 mr-1" />
                            Video
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Input Area */}
                    {testingMode === 'text' && (
                      <div className="flex space-x-2">
                        <Input
                          value={testInput}
                          onChange={(e) => setTestInput(e.target.value)}
                          placeholder={`Ask ${formData.name || 'your clone'} anything about ${formData.expertise || 'their expertise'}...`}
                          onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleTestMessage()}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleTestMessage}
                          disabled={!testInput.trim()}
                        >
                          Send
                        </Button>
                      </div>
                    )}
                    
                    {testingMode === 'audio' && (
                      <div className="flex space-x-2 items-center">
                        <div className="flex-1 text-center py-4 bg-slate-50 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
                          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                            {isRecording ? "🎙️ Recording... Click stop when done" : "🎤 Click to start voice recording"}
                          </p>
                        </div>
                        <Button 
                          onClick={isRecording ? stopAudioRecording : startAudioRecording}
                          variant={isRecording ? 'destructive' : 'default'}
                        >
                          <Mic className="h-4 w-4 mr-1" />
                          {isRecording ? 'Stop' : 'Record'}
                        </Button>
                      </div>
                    )}
                    
                    {testingMode === 'video' && (
                      <div className="space-y-4">
                        <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                          <div className="text-center">
                            <Video className="h-12 w-12 mx-auto text-slate-400 mb-2" />
                            <p className="text-sm text-slate-600 dark:text-slate-300">Video testing interface</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Your avatar will appear here during video calls</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Input
                            value={testInput}
                            onChange={(e) => setTestInput(e.target.value)}
                            placeholder={`Ask ${formData.name || 'your clone'} anything about ${formData.expertise || 'their expertise'}...`}
                            onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleTestMessage()}
                            className="flex-1"
                          />
                          <Button 
                            onClick={handleTestMessage}
                            disabled={!testInput.trim()}
                          >
                            Send
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Testing Info */}
                    <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                      <div className="flex items-center space-x-4 flex-wrap">
                        <span>💡 <strong>Testing Mode:</strong> {
                          createdCloneId && knowledgeProcessingStatus === 'completed' && (formData.documents.length > 0 || formData.links.length > 0)
                            ? 'RAG-enhanced responses with your knowledge base'
                            : 'GPT-4 with your clone\'s basic training data'
                        }</span>
                        <span>🔒 <strong>Privacy:</strong> Test conversations are not saved</span>
                        {knowledgeProcessingStatus === 'completed' && (formData.documents.length > 0 || formData.links.length > 0) && (
                          <span>📚 <strong>Knowledge:</strong> Enhanced with your documents</span>
                        )}
                        {knowledgeProcessingStatus === 'processing' && (
                          <span>⏳ <strong>Processing:</strong> Knowledge integration in progress</span>
                        )}
                        {knowledgeProcessingStatus === 'failed' && (
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col">
                              <span>⚠️ <strong>Warning:</strong> RAG memory unavailable, using basic LLM mode</span>
                              {retryCount > 0 && (
                                <span className="text-xs text-gray-500 mt-1">
                                  Retry attempts: {retryCount}
                                </span>
                              )}
                            </div>
                            {createdCloneId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => retryKnowledgeProcessing(createdCloneId)}
                                disabled={isProcessingKnowledge}
                                className="ml-4 flex-shrink-0"
                              >
                                {isProcessingKnowledge ? (
                                  <>
                                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                    Retrying...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    {retryCount > 0 ? 'Try Again' : 'Retry'}
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-full flex items-center justify-center mb-6">
                      <Play className="h-10 w-10 text-blue-600 ml-1" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">Test Your AI Clone</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-md mx-auto">
                      Start a conversation to see how your AI clone responds using your professional expertise and personality.
                    </p>
                    <Button 
                      onClick={() => setIsTestingClone(true)}
                      size="lg"
                      className="px-12 py-3 text-base"
                    >
                      <Play className="h-5 w-5 mr-3" />
                      Start Testing
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Improvement Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle>Optimization Tips</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Ways to improve your clone's performance
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">Great foundation!</p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        Your clone has solid training data and personality settings.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="h-5 w-5 bg-blue-500 rounded-full mt-0.5 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-white font-bold">💡</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Add more examples</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        More Q&A training data can improve response accuracy.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="h-5 w-5 bg-yellow-500 rounded-full mt-0.5 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-white font-bold">⚡</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Enable multimedia</p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        Add voice and video for richer interactions.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="h-5 w-5 bg-purple-500 rounded-full mt-0.5 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-white font-bold">🎯</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Refine personality</p>
                      <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                        Adjust personality sliders based on test conversations.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 7:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageCircle className="h-5 w-5" />
                    <span>Text Chat</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Price Range (per session)</Label>
                    <div className="flex space-x-2">
                      <Input
                        type="number"
                        value={formData.pricing.text.min}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: {
                              ...formData.pricing,
                              text: { ...formData.pricing.text, min: Number.parseInt(e.target.value) || 0 },
                            },
                          })
                        }
                        placeholder="Min"
                      />
                      <Input
                        type="number"
                        value={formData.pricing.text.max}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: {
                              ...formData.pricing,
                              text: { ...formData.pricing.text, max: Number.parseInt(e.target.value) || 0 },
                            },
                          })
                        }
                        placeholder="Max"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Recommended: $15-50 for your expertise level
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Mic className="h-5 w-5" />
                    <span>Voice Call</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Price Range (per session)</Label>
                    <div className="flex space-x-2">
                      <Input
                        type="number"
                        value={formData.pricing.voice.min}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: {
                              ...formData.pricing,
                              voice: { ...formData.pricing.voice, min: Number.parseInt(e.target.value) || 0 },
                            },
                          })
                        }
                        placeholder="Min"
                      />
                      <Input
                        type="number"
                        value={formData.pricing.voice.max}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: {
                              ...formData.pricing,
                              voice: { ...formData.pricing.voice, max: Number.parseInt(e.target.value) || 0 },
                            },
                          })
                        }
                        placeholder="Max"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Recommended: $25-75 for your expertise level
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Video className="h-5 w-5" />
                    <span>Video Call</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Price Range (per session)</Label>
                    <div className="flex space-x-2">
                      <Input
                        type="number"
                        value={formData.pricing.video.min}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: {
                              ...formData.pricing,
                              video: { ...formData.pricing.video, min: Number.parseInt(e.target.value) || 0 },
                            },
                          })
                        }
                        placeholder="Min"
                      />
                      <Input
                        type="number"
                        value={formData.pricing.video.max}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: {
                              ...formData.pricing,
                              video: { ...formData.pricing.video, max: Number.parseInt(e.target.value) || 0 },
                            },
                          })
                        }
                        placeholder="Max"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Recommended: $40-100 for your expertise level
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Availability Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Availability</Label>
                    <Select
                      value={formData.availability}
                      onValueChange={(value) => setFormData({ ...formData, availability: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24/7">24/7 Available</SelectItem>
                        <SelectItem value="business">Business Hours Only</SelectItem>
                        <SelectItem value="custom">Custom Schedule</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* RAG Knowledge Status */}
            {(formData.documents.length > 0 || formData.links.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Knowledge Integration Status</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    Status of your uploaded knowledge materials
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        {knowledgeProcessingStatus === 'completed' && (
                          <>
                            <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                            <div>
                              <p className="font-medium text-green-800 dark:text-green-200">Knowledge Integration Complete</p>
                              <p className="text-sm text-green-600 dark:text-green-400">
                                Your clone has access to {formData.documents.length} documents and {formData.links.length} links
                              </p>
                            </div>
                          </>
                        )}
                        {knowledgeProcessingStatus === 'processing' && (
                          <>
                            <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse"></div>
                            <div>
                              <p className="font-medium text-blue-800 dark:text-blue-200">Processing Knowledge</p>
                              <p className="text-sm text-blue-600 dark:text-blue-400">
                                Integration in progress... Your clone will be enhanced once complete.
                              </p>
                            </div>
                          </>
                        )}
                        {knowledgeProcessingStatus === 'failed' && (
                          <>
                            <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                            <div>
                              <p className="font-medium text-red-800 dark:text-red-200">Knowledge Processing Failed</p>
                              <p className="text-sm text-red-600 dark:text-red-400">
                                Your clone will work with basic training only. You can retry after launch.
                              </p>
                            </div>
                          </>
                        )}
                        {knowledgeProcessingStatus === 'partial' && (
                          <>
                            <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                            <div>
                              <p className="font-medium text-yellow-800 dark:text-yellow-200">Partial Integration</p>
                              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                                Some knowledge materials were integrated successfully.
                              </p>
                            </div>
                          </>
                        )}
                        {knowledgeProcessingStatus === 'pending' && (
                          <>
                            <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                            <div>
                              <p className="font-medium text-gray-800 dark:text-gray-200">Knowledge Pending</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Knowledge materials are ready to process.
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {knowledgeProcessingStatus === 'failed' && createdCloneId && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => retryKnowledgeProcessing(createdCloneId)}
                          disabled={isProcessingKnowledge}
                        >
                          {isProcessingKnowledge ? 'Retrying...' : 'Retry Processing'}
                        </Button>
                      )}
                    </div>

                    {/* Knowledge Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {formData.documents.length > 0 && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📄 Documents</h4>
                          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                            {formData.documents.slice(0, 3).map((doc, index) => (
                              <li key={index} className="truncate">• {doc.name}</li>
                            ))}
                            {formData.documents.length > 3 && (
                              <li className="text-blue-600 dark:text-blue-300">• +{formData.documents.length - 3} more documents</li>
                            )}
                          </ul>
                        </div>
                      )}
                      
                      {formData.links.length > 0 && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">🔗 Links</h4>
                          <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
                            {formData.links.slice(0, 3).map((link, index) => (
                              <li key={index} className="truncate">• {new URL(link).hostname}</li>
                            ))}
                            {formData.links.length > 3 && (
                              <li className="text-green-600 dark:text-green-300">• +{formData.links.length - 3} more links</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>

                    {knowledgeProcessingStatus === 'completed' && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <p className="text-sm text-green-800 dark:text-green-200">
                          🎉 <strong>Great!</strong> Your clone now has advanced knowledge capabilities and can provide more accurate, context-aware responses based on your uploaded materials.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Launch Options</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Button
                      variant={formData.status === "draft" ? "default" : "outline"}
                      onClick={() => setFormData({ ...formData, status: "draft" })}
                      className={formData.status === "draft" ? "" : "bg-transparent"}
                    >
                      Save as Draft
                    </Button>
                    <Button
                      variant={formData.status === "published" ? "default" : "outline"}
                      onClick={() => setFormData({ ...formData, status: "published" })}
                      className={formData.status === "published" ? "" : "bg-transparent"}
                    >
                      Publish Now
                    </Button>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {formData.status === "draft"
                      ? "Your clone will be saved but not visible to users yet."
                      : "Your clone will be immediately available to users on the platform."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  // Show loading state while loading clone data
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300">Loading clone data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {createdCloneId ? 'Edit Your AI Clone' : 'Create Your AI Clone'}
            </h1>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Step {currentStep} of {steps.length}
            </div>
          </div>
          <Progress value={progress} className="mb-4" />
          <div className="hidden lg:flex items-center space-x-4 overflow-x-auto">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center space-x-2 whitespace-nowrap ${
                  step.id === currentStep
                    ? "text-blue-600 dark:text-blue-400"
                    : step.id < currentStep
                      ? "text-green-600 dark:text-green-400"
                      : "text-slate-400"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step.id === currentStep
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : step.id < currentStep
                        ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}
                >
                  {step.id < currentStep ? <CheckCircle className="h-4 w-4" /> : step.id}
                </div>
                <div>
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="text-xs">{step.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{steps[currentStep - 1].title}</CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="bg-transparent w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
            <Button 
              variant="ghost" 
              className="w-full sm:w-auto"
              onClick={async () => {
                await saveProgress()
                router.push('/dashboard/creator')
              }}
              disabled={isSubmitting}
            >
              Save & Exit
            </Button>
            {currentStep === steps.length ? (
              <Button 
                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                onClick={handleFinalSubmit}
                disabled={isSubmitting || !validateStep(currentStep).isValid}
              >
                {isSubmitting ? (
                  <>Saving...</>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {formData.status === "published" ? "Launch Clone" : "Save Draft"}
                  </>
                )}
              </Button>
            ) : (
              <Button 
                onClick={handleNext} 
                className="w-full sm:w-auto"
                disabled={isSubmitting || isNavigating || !validateStep(currentStep).isValid}
              >
                {isSubmitting || isNavigating ? 'Saving...' : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CloneWizardPage() {
  return (
    <RequireCreator>
      <CloneWizardContent />
    </RequireCreator>
  );
}
