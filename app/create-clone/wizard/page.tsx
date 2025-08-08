"use client"

import { RequireCreator } from '@/components/auth/protected-route';
import { useState } from "react"
import { useRouter } from 'next/navigation'
import { createClone, updateClone, type CloneCreateRequest } from '@/lib/clone-api'
import { uploadDocument, createKnowledgeEntry, processUrl } from '@/lib/knowledge-api'
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

const sampleQuestions = [
  "What's your approach to helping clients overcome challenges?",
  "How do you typically structure your sessions?",
  "What's your philosophy on personal growth?",
  "How do you handle difficult or resistant clients?",
  "What makes your methodology unique?",
  "Describe your background and how you got into this field.",
  "What are the most common issues your clients face?",
  "How do you measure success with your clients?",
  "What's your typical session format and duration?",
  "How do you handle clients who are skeptical or resistant to change?",
  "What tools or techniques do you use most frequently?",
  "How do you stay updated with the latest developments in your field?",
  "What would you say to someone who's hesitant to seek help?",
  "How do you customize your approach for different personality types?",
  "What's the biggest misconception people have about your field?",
  "How do you handle emotional or difficult situations during sessions?",
  "What advice would you give to someone just starting their journey?",
  "How do you maintain boundaries while being supportive?",
  "What's your approach to goal setting with clients?",
  "How do you handle setbacks or lack of progress?",
]

function CloneWizardContent() {
  const router = useRouter()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdCloneId, setCreatedCloneId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    name: "",
    title: "",
    bio: "",
    expertise: "",
    credentials: [] as string[],
    languages: [] as string[],
    photo: null as File | null,

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

  const progress = (currentStep / steps.length) * 100

  const handleNext = async () => {
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
      
      if (!createdCloneId) {
        // Create initial clone
        const cloneData: CloneCreateRequest = {
          name: formData.name || 'Untitled Clone',
          description: formData.bio || 'Clone description',
          category: formData.expertise || 'coaching',
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

        const clone = await createClone(cloneData)
        setCreatedCloneId(clone.id)
        
        toast({
          title: "Progress saved",
          description: "Clone created and progress saved",
        })
      } else {
        // Update existing clone
        const updateData = {
          name: formData.name,
          description: formData.bio,
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

        await updateClone(createdCloneId, updateData)
        
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
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="photo">Profile Photo</Label>
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={formData.photo ? URL.createObjectURL(formData.photo) : "/placeholder.svg"} />
                      <AvatarFallback>
                        {formData.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <Button variant="outline" className="bg-transparent">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Photo
                    </Button>
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
                <div className="flex space-x-2 mb-2">
                  <Input
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    placeholder="English"
                    onKeyPress={(e) => e.key === "Enter" && addLanguage()}
                  />
                  <Button onClick={addLanguage} variant="outline" className="bg-transparent">
                    <Plus className="h-4 w-4" />
                  </Button>
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
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Q&A Training</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-slate-600 dark:text-slate-300">
                  Answer these questions to help train your AI clone's responses. The more detailed your answers, the
                  better your clone will perform.
                </p>
                <div className="grid grid-cols-1 gap-6">
                  {sampleQuestions.map((question, index) => (
                    <div key={index} className="space-y-3 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <Label className="text-sm font-medium text-slate-900 dark:text-white">
                        {index + 1}. {question}
                      </Label>
                      <Textarea
                        value={formData.qaResponses[question] || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            qaResponses: {
                              ...formData.qaResponses,
                              [question]: e.target.value,
                            },
                          })
                        }
                        placeholder="Provide a detailed response based on your expertise and experience..."
                        rows={4}
                        className="resize-none"
                      />
                      <div className="text-xs text-slate-500">
                        {formData.qaResponses[question]?.length || 0} characters
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Create Your AI Clone</h1>
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
              onClick={() => router.push('/dashboard/creator')}
              disabled={isSubmitting}
            >
              Save & Exit
            </Button>
            {currentStep === steps.length ? (
              <Button 
                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
