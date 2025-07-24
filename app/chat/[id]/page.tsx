"use client"

import { useState, useRef, useEffect } from "react"
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
  Pause,
  Clock,
  Star,
  ArrowLeft,
  Volume2,
  Download,
  Heart,
  Briefcase,
  GraduationCap,
  DollarSign,
  Scale,
  Stethoscope,
  User,
  LogOut,
} from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { useParams, useSearchParams } from "next/navigation"

const expertTypes = {
  medical: { color: "bg-emerald-500", icon: Stethoscope, name: "Health & Wellness", theme: "emerald" },
  business: { color: "bg-blue-500", icon: Briefcase, name: "Business & Strategy", theme: "blue" },
  education: { color: "bg-purple-500", icon: GraduationCap, name: "Education & Learning", theme: "purple" },
  finance: { color: "bg-amber-500", icon: DollarSign, name: "Finance & Investment", theme: "amber" },
  coaching: { color: "bg-orange-500", icon: Heart, name: "Life & Coaching", theme: "orange" },
  legal: { color: "bg-indigo-900", icon: Scale, name: "Legal & Consulting", theme: "indigo" },
}

// Mock expert data
const expert = {
  id: 1,
  name: "Dr. Sarah Chen",
  type: "coaching",
  specialty: "Life Coach & Therapist",
  avatar: "/placeholder.svg?height=60&width=60",
  rating: 4.9,
  sessions: 1247,
  pricePerMinute: 1.25,
  expertise: ["Anxiety Management", "Life Transitions", "Mindfulness", "CBT"],
  status: "online",
}

interface Message {
  id: string
  content: string
  sender: "user" | "expert"
  timestamp: Date
  typing?: boolean
}

const demoMessages: Message[] = [
  {
    id: "1",
    content:
      "Hello! I'm Dr. Sarah Chen's AI clone. I'm here to help you with life coaching, therapy techniques, and personal growth. What's on your mind today?",
    sender: "expert",
    timestamp: new Date(Date.now() - 60000),
  },
]

const quickSuggestions = [
  "I'm feeling overwhelmed with work stress",
  "How can I improve my self-confidence?",
  "I'm going through a major life transition",
  "Help me develop better coping strategies",
  "I want to work on my relationships",
]

export default function ChatPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const isDemo = searchParams?.get("demo") === "true"

  const [messages, setMessages] = useState<Message[]>(demoMessages)
  const [inputMessage, setInputMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [sessionTime, setSessionTime] = useState(0)
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionCost, setSessionCost] = useState(0)
  const [isRecording, setIsRecording] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typeConfig = expertTypes[expert.type as keyof typeof expertTypes]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (sessionActive && !isDemo) {
      interval = setInterval(() => {
        setSessionTime((prev) => {
          const newTime = prev + 1
          setSessionCost(Math.max(0, (newTime - 300) * (expert.pricePerMinute / 60))) // Free first 5 minutes
          return newTime
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [sessionActive, isDemo])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return

    if (!sessionActive && !isDemo) {
      setSessionActive(true)
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

    // Simulate AI response
    setTimeout(
      () => {
        const responses = [
          "I understand you're dealing with some challenges. Let's work through this together. Can you tell me more about what specifically is causing you the most stress?",
          "That's a very common concern, and it's great that you're reaching out for support. Based on my experience, I'd recommend starting with some mindfulness techniques. Have you tried any breathing exercises before?",
          "Thank you for sharing that with me. It takes courage to open up about these feelings. Let's explore some practical strategies that can help you feel more in control.",
          "I hear you, and what you're experiencing is completely valid. Many of my clients have faced similar situations. Let me share some evidence-based approaches that have been particularly effective.",
          "That's an excellent question. In my practice, I've found that the most sustainable changes often start small. What would feel like a manageable first step for you?",
        ]

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

  const handleQuickSuggestion = (suggestion: string) => {
    handleSendMessage(suggestion)
  }

  const handleEndSession = () => {
    setSessionActive(false)
    // In a real app, this would process payment and save session
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            <Link href={`/clone/${expert.id}`}>
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
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs flex-shrink-0">
                Online
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            <div className="hidden sm:flex items-center space-x-2 sm:space-x-4">
              <Link href="/profile">
                <Button variant="outline" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Profile</span>
                </Button>
              </Link>
              <Button variant="ghost" size="sm">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
            {!isDemo && (
              <div className="text-right text-xs sm:text-sm">
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="font-mono">{formatTime(sessionTime)}</span>
                </div>
                <div className="text-xs text-slate-500">Cost: ${sessionCost.toFixed(2)}</div>
              </div>
            )}
            {isDemo && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                Demo
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleEndSession}
              className="text-xs sm:text-sm bg-transparent"
            >
              {sessionActive ? "End" : "Close"}
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
                      className="text-left h-auto py-2 px-3 whitespace-normal text-xs sm:text-sm"
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
              <div className="flex items-end space-x-2 sm:space-x-3">
                <div className="flex-1">
                  <div className="relative">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Type your message..."
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
                <Button
                  variant="outline"
                  size="sm"
                  className={`rounded-xl h-10 w-10 p-0 flex-shrink-0 ${isRecording ? "bg-red-50 border-red-200 text-red-600" : ""}`}
                  onClick={() => setIsRecording(!isRecording)}
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </div>

              {!isDemo && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-3 text-xs text-slate-500 space-y-1 sm:space-y-0">
                  <span>Session rate: ${expert.pricePerMinute}/minute after first 5 minutes</span>
                  <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:block">
          <div className="space-y-4 lg:space-y-6">
            {/* Expert Info */}
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
                  <span className="text-slate-600 dark:text-slate-300">Rating</span>
                  <div className="flex items-center space-x-1">
                    <Star className="h-3 w-3 text-yellow-500 fill-current" />
                    <span className="font-medium">{expert.rating}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">Sessions</span>
                  <span className="font-medium">{expert.sessions.toLocaleString()}</span>
                </div>
                {!isDemo && (
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

            {/* Expertise Areas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base lg:text-lg">Expertise Areas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {expert.expertise.map((area, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {area}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Session Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base lg:text-lg">Session Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" size="sm" className="w-full justify-start bg-transparent text-sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Transcript
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start bg-transparent text-sm">
                  <Volume2 className="h-4 w-4 mr-2" />
                  Switch to Voice
                </Button>
                {!isDemo && (
                  <Button variant="outline" size="sm" className="w-full justify-start bg-transparent text-sm">
                    <Pause className="h-4 w-4 mr-2" />
                    Pause Session
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Quick Topics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base lg:text-lg">Quick Topics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    "Stress Management",
                    "Goal Setting",
                    "Relationship Issues",
                    "Career Guidance",
                    "Mindfulness Practice",
                  ].map((topic, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2 text-sm"
                      onClick={() => handleSendMessage(`I'd like to discuss ${topic.toLowerCase()}`)}
                    >
                      {topic}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
