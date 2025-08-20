"use client"

import { useState, useRef, useEffect } from "react"
import { useParams, useRouter } from 'next/navigation'
import { getClone, type CloneResponse } from '@/lib/clone-api'
import { useAuth } from '@/contexts/auth-context'
import { toast } from '@/components/ui/use-toast'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Send,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Pause,
  Play,
  Clock,
  Star,
  ArrowLeft,
  Volume2,
  VolumeX,
  Download,
  Heart,
  Briefcase,
  GraduationCap,
  DollarSign,
  Scale,
  Stethoscope,
  User,
  LogOut,
  Loader2,
  Phone,
  PhoneOff,
  MessageCircle,
  Info,
  Cpu
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
  ai: { color: "bg-cyan-600", icon: Cpu, name: "AI", theme: "cyan" }
}

interface Message {
  id: string
  content: string
  sender: "user" | "expert"
  timestamp: Date
  typing?: boolean
}

interface ExpertData extends CloneResponse {
  responseTime: string;
  languages: string[];
  pricing: {
    text: { min: number; max: number; duration: string };
    voice: { min: number; max: number; duration: string };
    video: { min: number; max: number; duration: string };
  };
  bio: string;
  credentials: string[];
  expertise: string[];
  availability: string;
  featured: boolean;
  type: string;
  specialty: string;
  sessions: number;
  priceFrom: number;
  priceTo: number;
}

const getQuickSuggestions = (category: string) => {
  const suggestions = {
    medical: [
      "I have symptoms I'd like to discuss",
      "Can you help me understand my condition?",
      "What are some preventive health measures?",
      "I need advice on wellness and lifestyle",
      "How can I manage my health better?"
    ],
    business: [
      "I need help with my business strategy",
      "How can I improve my leadership skills?",
      "What are best practices for team management?",
      "I want to grow my business revenue",
      "Help me with market analysis"
    ],
    education: [
      "I'm struggling with a learning concept",
      "How can I improve my study techniques?",
      "What career path should I consider?",
      "I need help with skill development",
      "How can I enhance my learning efficiency?"
    ],
    finance: [
      "I want to improve my financial planning",
      "How should I invest my money?",
      "Help me understand market trends",
      "I need budgeting advice",
      "What are good investment strategies?"
    ],
    coaching: [
      "I'm feeling overwhelmed with work stress",
      "How can I improve my self-confidence?",
      "I'm going through a major life transition",
      "Help me develop better coping strategies",
      "I want to work on my relationships"
    ],
    legal: [
      "I need legal advice for my situation",
      "Can you explain this legal concept?",
      "What are my rights in this matter?",
      "Help me understand legal procedures",
      "I need guidance on compliance issues"
    ],
    ai: [
      "How can AI help my business?",
      "What are the latest AI trends?",
      "I need help implementing AI solutions",
      "Explain AI concepts to me",
      "How can I leverage AI for productivity?"
    ]
  }
  
  return suggestions[category as keyof typeof suggestions] || suggestions.coaching
}

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [expert, setExpert] = useState<ExpertData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [sessionTime, setSessionTime] = useState(0)
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionCost, setSessionCost] = useState(0)
  const [sessionMode, setSessionMode] = useState<'text' | 'voice' | 'video'>('text')
  const [isRecording, setIsRecording] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const cloneId = params.id as string

  // Fetch clone data
  useEffect(() => {
    const fetchClone = async () => {
      try {
        setLoading(true)
        const cloneData = await getClone(cloneId)
        
        // Transform clone data to match our expert interface
        const transformedExpert: ExpertData = {
          ...cloneData,
          rating: cloneData.average_rating || 0,
          type: cloneData.category || 'coaching',
          specialty: cloneData.description,
          sessions: cloneData.total_sessions || 0,
          priceFrom: cloneData.base_price,
          priceTo: Math.floor(cloneData.base_price * 1.5),
          responseTime: "< 2 minutes",
          languages: ["English"],
          pricing: {
            text: { min: cloneData.base_price, max: Math.floor(cloneData.base_price * 1.2), duration: "30-60 min" },
            voice: { min: Math.floor(cloneData.base_price * 1.4), max: Math.floor(cloneData.base_price * 1.8), duration: "30-60 min" },
            video: { min: Math.floor(cloneData.base_price * 2), max: Math.floor(cloneData.base_price * 2.5), duration: "30-60 min" },
          },
          bio: cloneData.instructions || `${cloneData.name} is an AI clone expert ready to help you with personalized guidance and insights.`,
          credentials: cloneData.expertise_areas?.slice(0, 6) || ["Expert Professional"],
          expertise: cloneData.expertise_areas || ["General Consulting"],
          availability: cloneData.is_published ? "Available now" : "Currently unavailable",
          featured: false,
        }
        
        setExpert(transformedExpert)
        
        // Set initial welcome message
        const welcomeMessage: Message = {
          id: "welcome-1",
          content: `Hello! I'm ${transformedExpert.name}'s AI clone. I'm here to help you with ${transformedExpert.type} guidance and insights. What would you like to discuss today?`,
          sender: "expert",
          timestamp: new Date(),
        }
        setMessages([welcomeMessage])
        
      } catch (error) {
        console.error('Failed to fetch clone:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setError(`Failed to load clone: ${errorMessage}`)
        toast({
          title: "Error",
          description: `Failed to load clone: ${errorMessage}`,
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (cloneId) {
      fetchClone()
    }
  }, [cloneId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (sessionActive) {
      interval = setInterval(() => {
        setSessionTime((prev) => {
          const newTime = prev + 1
          if (expert) {
            const currentRate = sessionMode === 'text' ? expert.pricing.text.min : 
                             sessionMode === 'voice' ? expert.pricing.voice.min : 
                             expert.pricing.video.min
            setSessionCost(Math.max(0, (newTime - 300) * (currentRate / 60))) // Free first 5 minutes
          }
          return newTime
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [sessionActive, sessionMode, expert])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !expert) return

    if (!sessionActive) {
      setSessionActive(true)
      setConnectionStatus('connecting')
      setTimeout(() => setConnectionStatus('connected'), 1500)
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputMessage("")
    setIsTyping(true)

    // Simulate AI response based on category
    setTimeout(
      () => {
        const responses = getCategoryResponses(expert.type)
        const expertMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: responses[Math.floor(Math.random() * responses.length)],
          sender: "expert",
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, expertMessage])
        setIsTyping(false)
      },
      2000 + Math.random() * 1000,
    )
  }

  const getCategoryResponses = (category: string) => {
    const responses = {
      medical: [
        "I understand your health concerns. Let's discuss this carefully. Can you provide more details about your symptoms or the specific area you'd like guidance on?",
        "Health is our most valuable asset. Based on what you've shared, I'd recommend we explore this topic step by step. What's your primary concern today?",
        "Thank you for reaching out about your health matter. I'm here to provide guidance and support. Let's work together to address your concerns."
      ],
      business: [
        "Excellent business question! Strategic thinking is key to success. Let me help you analyze this situation and develop actionable solutions.",
        "I appreciate you bringing this business challenge to me. Let's break down the components and create a strategic approach to move forward.",
        "Great to discuss business strategy with you! Based on my experience, let's explore the best practices and innovative approaches for your situation."
      ],
      education: [
        "Learning is a lifelong journey, and I'm excited to help you on this path. Let's explore effective strategies and methodologies for your educational goals.",
        "Education is about more than just knowledge transfer - it's about developing critical thinking. What specific area would you like to focus on?",
        "I'm here to support your learning journey. Let's work together to find the most effective approaches for your educational needs."
      ],
      finance: [
        "Financial planning is crucial for long-term success. Let me help you understand the best strategies for your specific situation and goals.",
        "Money management and investment decisions require careful consideration. I'm here to guide you through the complexities of financial planning.",
        "Great question about finance! Let's analyze your situation and explore strategies that align with your risk tolerance and financial objectives."
      ],
      coaching: [
        "I understand you're dealing with some challenges. Let's work through this together. Can you tell me more about what specifically is causing you the most concern?",
        "That's a very common situation, and it's great that you're reaching out for support. Based on my experience, let's explore some practical strategies.",
        "Thank you for sharing that with me. It takes courage to open up about these feelings. Let's explore some evidence-based approaches that can help."
      ],
      legal: [
        "Legal matters require careful attention to detail. I'm here to help you understand the relevant concepts and procedures for your situation.",
        "Thank you for bringing this legal question to me. Let's analyze the key aspects and explore the best approaches for your specific circumstances.",
        "Legal guidance is important for making informed decisions. I'll help you understand the relevant principles and considerations."
      ],
      ai: [
        "AI is transforming how we work and live! I'm excited to discuss the possibilities and help you understand how to leverage these technologies effectively.",
        "Great question about artificial intelligence! Let's explore the current trends, applications, and potential benefits for your specific needs.",
        "AI technologies offer incredible opportunities. I'm here to help you understand and implement the best solutions for your goals."
      ]
    }
    
    return responses[category as keyof typeof responses] || responses.coaching
  }

  const handleQuickSuggestion = (suggestion: string) => {
    handleSendMessage(suggestion)
  }

  const handleEndSession = () => {
    setSessionActive(false)
    setConnectionStatus('disconnected')
    // In a real app, this would process payment and save session
  }

  const handleModeChange = (mode: 'text' | 'voice' | 'video') => {
    if (sessionActive && mode !== sessionMode) {
      setSessionMode(mode)
      
      const modeMessage: Message = {
        id: `mode-${Date.now()}`,
        content: `Switching to ${mode} mode. ${mode === 'voice' ? 'You can now speak with me.' : mode === 'video' ? 'Video call is now active.' : 'Back to text chat.'}`,
        sender: "expert",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, modeMessage])
    } else {
      setSessionMode(mode)
    }
  }

  const toggleRecording = () => {
    setIsRecording(!isRecording)
    if (!isRecording && sessionMode === 'text') {
      handleModeChange('voice')
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const toggleVideo = () => {
    setIsVideoOn(!isVideoOn)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-300">Loading session...</p>
        </div>
      </div>
    )
  }

  if (error || !expert) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Session Not Available</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-4">{error || 'The requested session could not be started.'}</p>
          <div className="space-x-2">
            <Button onClick={() => router.back()}>Go Back</Button>
            <Link href="/discover">
              <Button variant="outline">Browse Other Experts</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!expert.is_published) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Expert Not Available</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-4">This expert is not yet published and cannot start sessions.</p>
          <div className="space-x-2">
            <Button onClick={() => router.back()}>Go Back</Button>
            <Link href="/discover">
              <Button variant="outline">Browse Available Experts</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const typeConfig = expertTypes[expert.type as keyof typeof expertTypes] || expertTypes.coaching
  const quickSuggestions = getQuickSuggestions(expert.type)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            <Link href="/discover">
              <Button variant="ghost" size="sm" className="flex-shrink-0">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="relative flex-shrink-0">
                <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                  <AvatarImage src={expert.avatar || "/placeholder.svg"} alt={expert.name} />
                  <AvatarFallback>
                    {expert.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-1 -right-1 ${typeConfig.color} rounded-full p-1`}>
                  <typeConfig.icon className="h-2 w-2 sm:h-3 sm:w-3 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                  {expert.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 truncate">{expert.specialty}</p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge 
                  className={
                    connectionStatus === 'connected' ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                    connectionStatus === 'connecting' ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" :
                    "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  }
                >
                  {connectionStatus === 'connected' ? 'Connected' : 
                   connectionStatus === 'connecting' ? 'Connecting...' : 
                   'Ready'}
                </Badge>
                <Badge variant="outline" className={`${typeConfig.color} text-white text-xs`}>
                  {sessionMode.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>

          {/* Session Controls */}
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            {sessionActive && (
              <div className="text-right text-xs sm:text-sm">
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="font-mono">{formatTime(sessionTime)}</span>
                </div>
                <div className="text-xs text-slate-500">Cost: ${sessionCost.toFixed(2)}</div>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleEndSession}
              className="text-xs sm:text-sm bg-transparent"
            >
              {sessionActive ? "End Session" : "Close"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4 max-w-4xl mx-auto">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex items-start space-x-2 sm:space-x-3 max-w-[85%] sm:max-w-[80%] ${message.sender === "user" ? "flex-row-reverse space-x-reverse" : ""}`}
                    >
                      {message.sender === "expert" && (
                        <Avatar className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0">
                          <AvatarImage src={expert.avatar || "/placeholder.svg"} alt={expert.name} />
                          <AvatarFallback>
                            {expert.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 ${
                          message.sender === "user"
                            ? `bg-${typeConfig.theme}-500 text-white`
                            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <p
                          className={`text-sm sm:text-base ${message.sender === "expert" ? "text-slate-900 dark:text-white" : ""}`}
                        >
                          {message.content}
                        </p>
                        <p
                          className={`text-xs mt-2 ${
                            message.sender === "user" ? "text-white/70" : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                      <AvatarImage src={expert.avatar || "/placeholder.svg"} alt={expert.name} />
                      <AvatarFallback>
                        {expert.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 sm:px-4 sm:py-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Quick Suggestions */}
          {messages.length <= 1 && (
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800">
              <div className="max-w-4xl mx-auto">
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-3">
                  Quick suggestions to get started:
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickSuggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickSuggestion(suggestion)}
                      className="text-left h-auto py-2 px-3 whitespace-normal text-xs sm:text-sm bg-transparent"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="max-w-4xl mx-auto">
              {/* Mode Controls */}
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Button
                  variant={sessionMode === 'text' ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleModeChange('text')}
                  className="flex items-center space-x-1"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Text</span>
                </Button>
                <Button
                  variant={sessionMode === 'voice' ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleModeChange('voice')}
                  className="flex items-center space-x-1"
                >
                  <Phone className="h-4 w-4" />
                  <span className="hidden sm:inline">Voice</span>
                </Button>
                <Button
                  variant={sessionMode === 'video' ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleModeChange('video')}
                  className="flex items-center space-x-1"
                >
                  <Video className="h-4 w-4" />
                  <span className="hidden sm:inline">Video</span>
                </Button>
              </div>

              {/* Input Controls */}
              <div className="flex items-end space-x-2 sm:space-x-3">
                <div className="flex-1">
                  <div className="relative">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={
                        sessionMode === 'text' ? "Type your message..." :
                        sessionMode === 'voice' ? "Press mic to speak or type..." :
                        "Start video call or type message..."
                      }
                      className="pr-12 py-2 sm:py-3 rounded-2xl border-2 focus:border-blue-500 dark:focus:border-blue-400 text-sm sm:text-base"
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage(inputMessage)
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-xl h-8 w-8 p-0"
                      onClick={() => handleSendMessage(inputMessage)}
                      disabled={!inputMessage.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Voice/Video Controls */}
                {sessionMode === 'voice' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`rounded-xl h-10 w-10 p-0 flex-shrink-0 ${isRecording ? "bg-red-50 border-red-200 text-red-600" : ""}`}
                      onClick={toggleRecording}
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`rounded-xl h-10 w-10 p-0 flex-shrink-0 ${isMuted ? "bg-red-50 border-red-200 text-red-600" : ""}`}
                      onClick={toggleMute}
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </>
                )}
                
                {sessionMode === 'video' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`rounded-xl h-10 w-10 p-0 flex-shrink-0 ${!isVideoOn ? "bg-red-50 border-red-200 text-red-600" : ""}`}
                      onClick={toggleVideo}
                    >
                      {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`rounded-xl h-10 w-10 p-0 flex-shrink-0 ${isMuted ? "bg-red-50 border-red-200 text-red-600" : ""}`}
                      onClick={toggleMute}
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </>
                )}
                
                {sessionMode === 'text' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`rounded-xl h-10 w-10 p-0 flex-shrink-0 ${isRecording ? "bg-red-50 border-red-200 text-red-600" : ""}`}
                    onClick={toggleRecording}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-3 text-xs text-slate-500 space-y-1 sm:space-y-0">
                <span>
                  {sessionMode === 'text' && `Text: $${expert.pricing.text.min}/session`}
                  {sessionMode === 'voice' && `Voice: $${expert.pricing.voice.min}/session`}
                  {sessionMode === 'video' && `Video: $${expert.pricing.video.min}/session`}
                  {" • Free first 5 minutes"}
                </span>
                <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:block">
          <div className="space-y-4 lg:space-y-6">
            {/* Session Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base lg:text-lg">Session Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">Expert</span>
                  <span className="font-medium truncate ml-2">{expert.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">Mode</span>
                  <Badge variant="secondary" className={`${typeConfig.color} text-white text-xs`}>
                    {sessionMode.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">Status</span>
                  <Badge 
                    className={
                      connectionStatus === 'connected' ? "bg-green-100 text-green-800" :
                      connectionStatus === 'connecting' ? "bg-yellow-100 text-yellow-800" :
                      "bg-gray-100 text-gray-800"
                    }
                  >
                    {connectionStatus === 'connected' ? 'Connected' : 
                     connectionStatus === 'connecting' ? 'Connecting' : 
                     'Ready'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">Rating</span>
                  <div className="flex items-center space-x-1">
                    <Star className="h-3 w-3 text-yellow-500 fill-current" />
                    <span className="font-medium">{expert.rating}</span>
                  </div>
                </div>
                {sessionActive && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300">Duration</span>
                      <span className="font-mono font-medium">{formatTime(sessionTime)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300">Current Cost</span>
                      <span className="font-medium">${sessionCost.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Expert Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base lg:text-lg">About Expert</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">{expert.bio}</p>
                <div>
                  <h4 className="text-sm font-medium mb-2">Expertise</h4>
                  <div className="flex flex-wrap gap-1">
                    {expert.expertise.slice(0, 4).map((area, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Session Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base lg:text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" size="sm" className="w-full justify-start bg-transparent text-sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Transcript
                </Button>
                <Link href={`/clone/${expert.id}`}>
                  <Button variant="outline" size="sm" className="w-full justify-start bg-transparent text-sm">
                    <Info className="h-4 w-4 mr-2" />
                    View Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}