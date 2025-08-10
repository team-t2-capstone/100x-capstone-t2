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
import { uploadDocument, createKnowledgeEntry, processUrl } from '@/lib/knowledge-api'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { toast } from '@/components/ui/use-toast'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
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
} from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

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
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    name: "",
    title: "",
    bio: "",
    expertise: "",
    customDomain: "",
    credentials: [] as string[],
    languages: [] as string[],
    photo: null as File | null,
    existingAvatarUrl: "",

    // Step 2: Q&A Training
    qaResponses: {} as Record<string, string>,

    // Step 3: Knowledge Transfer
    documents: [] as File[],
    links: [] as string[],

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

    // Step 6: Testing (results)
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

  const [newCredential, setNewCredential] = useState("")
  const [newLanguage, setNewLanguage] = useState("")
  const [newLink, setNewLink] = useState("")

  // Load existing clone data if editing
  useEffect(() => {
    const cloneId = searchParams.get('clone_id')
    if (cloneId) {
      loadCloneData(cloneId)
    }
  }, [searchParams])

  const loadCloneData = async (cloneId: string) => {
    try {
      setIsLoading(true)
      setCreatedCloneId(cloneId)
      
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
        console.log('Avatar URL from DB:', clone.avatar_url)
        console.log('Expertise areas from DB:', clone.expertise_areas)
        
        // Parse credentials with better handling
        let credentialsArray = []
        if (clone.credentials_qualifications && typeof clone.credentials_qualifications === 'string') {
          credentialsArray = clone.credentials_qualifications.split(',').map(c => c.trim()).filter(c => c.length > 0)
        } else if (Array.isArray(clone.expertise_areas)) {
          credentialsArray = clone.expertise_areas
        }
        
        console.log('Parsed credentials array:', credentialsArray)
        
        // Load Q&A responses
        const qaResponses = await loadQAResponses(cloneId)
        
        // Populate form data with existing clone data
        setFormData({
          // Step 1: Basic Information
          name: clone.name || "",
          title: clone.professional_title || "",
          bio: clone.bio || "",
          expertise: clone.category || "",
          customDomain: clone.category === 'other' || !Object.keys(expertTypes).includes(clone.category) ? clone.category : "",
          credentials: credentialsArray,
          languages: clone.languages || ['English'],
          photo: null,
          existingAvatarUrl: clone.avatar_url || "",

          // Step 2: Q&A Training - load from clone_qa_training table
          qaResponses: qaResponses,

          // Step 3: Knowledge Transfer
          documents: [],
          links: [],

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

          // Step 6: Testing & Preview
          testPrompt: "",
          testResponse: "",

          // Step 7: Pricing & Launch
          pricing: {
            text: { min: clone.base_price || 25, max: clone.base_price || 25 },
            voice: { min: Math.floor((clone.base_price || 25) * 1.5), max: Math.floor((clone.base_price || 25) * 1.5) },
            video: { min: Math.floor((clone.base_price || 25) * 2), max: Math.floor((clone.base_price || 25) * 2) },
          },
          isPublished: clone.is_published || false,
        })
        
        toast({
          title: "Clone data loaded",
          description: "Your existing clone data has been loaded for editing",
        })
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
  const [testMessages, setTestMessages] = useState([
    {
      id: "1",
      content:
        "Hello! I'm your AI clone. I'm ready to help with questions about life coaching and personal development. What would you like to discuss?",
      sender: "clone" as "user" | "clone",
      timestamp: new Date(),
    },
  ])
  const [testInput, setTestInput] = useState("")

  // Calculate progress based on sections completed
  const calculateProgress = () => {
    const totalSections = 7 // Total number of sections
    let completedSections = 0
    
    // Section 1: Basic Information
    if (formData.name && formData.title && formData.expertise && formData.bio) {
      if (formData.expertise !== "other" || formData.customDomain) {
        completedSections++
      }
    }
    
    // Section 2: Q&A Training
    const answeredQuestions = Object.values(formData.qaResponses).filter(answer => answer.trim()).length
    if (answeredQuestions >= 5) {
      completedSections++
    }
    
    // Section 3: Knowledge Transfer (optional - always counts as completed)
    completedSections++
    
    // Section 4: Personality & Style
    if (formData.communicationStyle && formData.responseLength) {
      completedSections++
    }
    
    // Section 5: Media Training (optional - always counts as completed)
    completedSections++
    
    // Section 6: Testing & Preview (always counts as completed)
    completedSections++
    
    // Section 7: Pricing & Launch
    if (formData.pricing.text.min > 0 && formData.pricing.voice.min > 0 && formData.pricing.video.min > 0) {
      completedSections++
    }
    
    return Math.round((completedSections / totalSections) * 100)
  }
  
  const progress = calculateProgress()

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

  // Upload file to Supabase Storage
  const uploadFile = async (file: File, bucket: string, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${folder}/${fileName}`

      // Upload with upsert to handle overwriting
      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true })

      if (error) {
        console.error('Upload error:', error)
        return null
      }

      // Get public URL - this should work for public buckets
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

      console.log('Uploaded file to path:', filePath)
      console.log('Generated public URL:', data.publicUrl)
      
      return data.publicUrl
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
      // Save progress before moving to next step
      await saveProgress()
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const saveProgress = async () => {
    try {
      setIsSubmitting(true)
      
      // Upload photo if exists
      let avatarUrl = null
      if (formData.photo) {
        avatarUrl = await uploadFile(formData.photo, 'avatars', 'clone-avatars')
        if (!avatarUrl) {
          toast({
            title: "Photo upload failed",
            description: "Continuing without photo upload",
            variant: "destructive",
          })
        }
      }
      
      if (!createdCloneId) {
        // Create initial clone
        const cloneData: CloneCreateRequest = {
          name: formData.name || 'Untitled Clone',
          category: formData.expertise === 'other' ? formData.customDomain || 'Other' : formData.expertise || 'coaching',
          expertise_areas: formData.credentials,
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
          credentials_qualifications: formData.credentials.length > 0 ? formData.credentials.join(', ') : null,
          avatar_url: avatarUrl || formData.existingAvatarUrl || null,
          category: cloneData.category,
          expertise_areas: cloneData.expertise_areas,
          languages: cloneData.languages.length > 0 ? cloneData.languages : ['English'],
          base_price: cloneData.base_price,
          personality_traits: cloneData.personality_traits,
          communication_style: cloneData.communication_style,
          is_published: false,
          is_active: true,
        }

        console.log('Creating clone with data:', supabaseCloneData)
        console.log('Credentials being saved:', formData.credentials)
        console.log('Avatar URL being saved:', avatarUrl || formData.existingAvatarUrl)

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
          
          // Save Q&A data if there are responses
          if (Object.keys(formData.qaResponses).length > 0) {
            await saveQAResponses(clone.id, formData.qaResponses)
          }
        }
        
        toast({
          title: "Progress saved",
          description: "Clone created and progress saved",
        })
      } else {
        // Update existing clone
        const updateData = {
          name: formData.name,
          expertise_areas: formData.credentials,
          base_price: formData.pricing.text.min,
          bio: formData.bio,
          personality_traits: formData.personality,
          communication_style: {
            style: formData.communicationStyle,
            response_length: formData.responseLength,
          },
          languages: formData.languages,
        }

        // Update clone directly in Supabase
        const supabaseUpdateData = {
          name: updateData.name,
          professional_title: formData.title,
          bio: updateData.bio,
          credentials_qualifications: formData.credentials.length > 0 ? formData.credentials.join(', ') : null,
          avatar_url: avatarUrl || formData.existingAvatarUrl || null,
          category: formData.expertise === 'other' ? formData.customDomain || 'Other' : formData.expertise || 'coaching',
          expertise_areas: updateData.expertise_areas,
          languages: updateData.languages.length > 0 ? updateData.languages : ['English'],
          base_price: updateData.base_price,
          personality_traits: updateData.personality_traits,
          communication_style: updateData.communication_style,
          updated_at: new Date().toISOString(),
        }
        
        console.log('Updating clone with data:', supabaseUpdateData)
        console.log('Credentials being updated:', formData.credentials)
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
        
        // Save Q&A data if there are responses
        if (Object.keys(formData.qaResponses).length > 0) {
          await saveQAResponses(createdCloneId, formData.qaResponses)
        }
        
        toast({
          title: "Progress saved",
          description: "Clone updated successfully",
        })
      }
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save progress",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFinalSubmit = async () => {
    try {
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

      // Process uploaded documents
      if (formData.documents.length > 0) {
        const docPromises = formData.documents.map(doc =>
          uploadDocument(createdCloneId!, {
            file: doc,
            title: doc.name,
            tags: ['training_material'],
          })
        )
        
        await Promise.all(docPromises)
      }

      // Process URLs
      if (formData.links.length > 0) {
        const urlPromises = formData.links.map(url =>
          processUrl(createdCloneId!, url)
        )
        
        await Promise.all(urlPromises)
      }

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

  const addCredential = () => {
    if (newCredential.trim()) {
      setFormData({
        ...formData,
        credentials: [...formData.credentials, newCredential.trim()],
      })
      setNewCredential("")
    }
  }

  const removeCredential = (index: number) => {
    setFormData({
      ...formData,
      credentials: formData.credentials.filter((_, i) => i !== index),
    })
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

  const handleTestMessage = () => {
    if (!testInput.trim()) return

    const userMessage = {
      id: Date.now().toString(),
      content: testInput,
      sender: "user" as "user" | "clone",
      timestamp: new Date(),
    }

    setTestMessages([...testMessages, userMessage])
    setTestInput("")

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "That's a great question! Based on my experience, I'd recommend starting with small, manageable goals. What specific area would you like to focus on first?",
        "I understand what you're going through. Many of my clients have faced similar challenges. Let me share a framework that has been particularly effective...",
        "Thank you for sharing that with me. It takes courage to open up about these feelings. Here's how I typically approach this situation...",
        "That's an excellent insight! You're already showing great self-awareness. Let's build on that foundation...",
        "I hear you, and what you're experiencing is completely normal. Here are some practical strategies we can explore together...",
      ]

      const cloneMessage = {
        id: (Date.now() + 1).toString(),
        content: responses[Math.floor(Math.random() * responses.length)],
        sender: "clone" as "user" | "clone",
        timestamp: new Date(),
      }

      setTestMessages((prev) => [...prev, cloneMessage])
    }, 1500)
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
                          console.error('Avatar image failed to load:', formData.existingAvatarUrl)
                          console.error('Trying to load URL:', e.currentTarget.src)
                          // Fallback to placeholder on error
                          e.currentTarget.src = "/placeholder.svg"
                        }}
                        onLoad={() => {
                          if (formData.existingAvatarUrl) {
                            console.log('Avatar loaded successfully:', formData.existingAvatarUrl)
                          }
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
                <Label>Credentials & Qualifications</Label>
                <div className="flex space-x-2 mb-2">
                  <Input
                    value={newCredential}
                    onChange={(e) => setNewCredential(e.target.value)}
                    placeholder="PhD Psychology - Stanford University"
                    onKeyPress={(e) => e.key === "Enter" && addCredential()}
                  />
                  <Button onClick={addCredential} variant="outline" className="bg-transparent">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.credentials.map((credential, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                      <span>{credential}</span>
                      <button onClick={() => removeCredential(index)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
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
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <p className="text-green-800 dark:text-green-200 text-sm">
                ✅ This step is optional. You can skip this section and add knowledge materials later, or proceed to the next step.
              </p>
            </div>
            <Tabs defaultValue="documents" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="links">Links & URLs</TabsTrigger>
              </TabsList>

              <TabsContent value="documents" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      <span>Upload Documents</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center">
                      <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                        Drag and drop your files here
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 mb-4">PDF, DOC, TXT files up to 10MB each</p>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,.md,.rtf"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || [])
                          setFormData({
                            ...formData,
                            documents: [...formData.documents, ...files]
                          })
                        }}
                        className="hidden"
                        id="file-upload"
                      />
                      <Button 
                        variant="outline" 
                        className="bg-transparent"
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        Choose Files
                      </Button>
                    </div>

                    {formData.documents.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <Label>Uploaded Documents</Label>
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
                    )}
                  </CardContent>
                </Card>
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
                    <div className="flex space-x-2">
                      <Input
                        value={newLink}
                        onChange={(e) => setNewLink(e.target.value)}
                        placeholder="https://example.com/your-content"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Test Your Clone</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsTestingClone(!isTestingClone)}
                      className="bg-transparent"
                    >
                      {isTestingClone ? "Stop Test" : "Start Test"}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isTestingClone ? (
                    <div className="space-y-4">
                      <div className="h-96 border border-slate-200 dark:border-slate-700 rounded-lg p-4 overflow-y-auto">
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
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                                }`}
                              >
                                <p className="text-sm">{message.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Input
                          value={testInput}
                          onChange={(e) => setTestInput(e.target.value)}
                          placeholder="Type a message to test your clone..."
                          onKeyPress={(e) => e.key === "Enter" && handleTestMessage()}
                        />
                        <Button onClick={handleTestMessage}>Send</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Play className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 dark:text-slate-300">
                        Click "Start Test" to begin testing your AI clone
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Clone Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Knowledge Accuracy</span>
                      <span className="text-sm font-medium">{formData.testResults.accuracy}%</span>
                    </div>
                    <Progress value={formData.testResults.accuracy} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Personality Match</span>
                      <span className="text-sm font-medium">{formData.testResults.personality}%</span>
                    </div>
                    <Progress value={formData.testResults.personality} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Response Quality</span>
                      <span className="text-sm font-medium">{formData.testResults.knowledge}%</span>
                    </div>
                    <Progress value={formData.testResults.knowledge} />
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Ready to Launch</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Improvement Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Great personality match!</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Your clone's responses align well with your defined personality traits.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="h-5 w-5 bg-yellow-500 rounded-full mt-0.5 flex items-center justify-center">
                      <span className="text-xs text-white font-bold">!</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Consider adding more examples</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Adding more Q&A examples could improve response accuracy in edge cases.
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
                disabled={isSubmitting || !validateStep(currentStep).isValid}
              >
                {isSubmitting ? 'Saving...' : (
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
