"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Star,
  MessageCircle,
  Mic,
  Video,
  Clock,
  CheckCircle,
  Play,
  ArrowRight,
  Stethoscope,
  Briefcase,
  GraduationCap,
  DollarSign,
  Heart,
  Scale,
  User,
  LogOut,
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

const expertTypes = {
  medical: { color: "bg-emerald-500", icon: Stethoscope, name: "Health & Wellness" },
  business: { color: "bg-blue-500", icon: Briefcase, name: "Business & Strategy" },
  education: { color: "bg-purple-500", icon: GraduationCap, name: "Education & Learning" },
  finance: { color: "bg-amber-500", icon: DollarSign, name: "Finance & Investment" },
  coaching: { color: "bg-orange-500", icon: Heart, name: "Life & Coaching" },
  legal: { color: "bg-indigo-900", icon: Scale, name: "Legal & Consulting" },
}

// Mock expert data - in real app this would come from API
const expert = {
  id: 1,
  name: "Dr. Sarah Chen",
  type: "coaching",
  specialty: "Life Coach & Therapist",
  avatar: "/placeholder.svg?height=120&width=120",
  rating: 4.9,
  sessions: 1247,
  responseTime: "< 2 minutes",
  languages: ["English", "Mandarin"],
  pricing: {
    text: { min: 25, max: 50, duration: "30-60 min" },
    voice: { min: 35, max: 75, duration: "30-60 min" },
    video: { min: 50, max: 100, duration: "30-60 min" },
  },
  bio: "Dr. Sarah Chen is a licensed clinical psychologist with over 15 years of experience helping individuals overcome anxiety, depression, and life transitions. She specializes in cognitive-behavioral therapy (CBT) and mindfulness-based interventions. Dr. Chen has helped thousands of clients develop resilience, improve relationships, and achieve their personal goals.",
  credentials: [
    "PhD in Clinical Psychology - Stanford University",
    "Licensed Clinical Psychologist (CA)",
    "Certified CBT Therapist",
    "Mindfulness-Based Stress Reduction (MBSR) Certified",
    "15+ years of clinical experience",
    "Published researcher in anxiety and depression treatment",
  ],
  expertise: [
    "Anxiety and Stress Management",
    "Depression Treatment",
    "Relationship Counseling",
    "Life Transitions",
    "Mindfulness and Meditation",
    "Cognitive Behavioral Therapy",
    "Personal Growth and Development",
    "Work-Life Balance",
  ],
  availability: "Available now",
  featured: true,
}

const reviews = [
  {
    id: 1,
    user: "Jennifer M.",
    avatar: "/placeholder.svg?height=40&width=40",
    rating: 5,
    date: "2 days ago",
    content:
      "Dr. Chen's clone provided incredibly insightful guidance on managing my work anxiety. The \"Dr. Chen's clone provided incredibly insightful guidance on managing my work anxiety. The conversation felt natural and her advice was practical and actionable. Highly recommend!",
    sessionType: "Text Chat",
    helpful: 12,
  },
  {
    id: 2,
    user: "Michael R.",
    avatar: "/placeholder.svg?height=40&width=40",
    rating: 5,
    date: "1 week ago",
    content:
      "Amazing experience! The voice session felt like talking to a real therapist. Dr. Chen's clone helped me work through some relationship issues with great empathy and professional insight.",
    sessionType: "Voice Call",
    helpful: 8,
  },
  {
    id: 3,
    user: "Lisa K.",
    avatar: "/placeholder.svg?height=40&width=40",
    rating: 4,
    date: "2 weeks ago",
    content:
      "Very helpful for developing coping strategies for stress. The clone remembered our previous conversations and built upon them effectively. Great value for the price.",
    sessionType: "Text Chat",
    helpful: 15,
  },
  {
    id: 4,
    user: "David L.",
    avatar: "/placeholder.svg?height=40&width=40",
    rating: 5,
    date: "3 weeks ago",
    content:
      "The video session was incredible - felt like a real therapy appointment. Dr. Chen's clone provided excellent guidance on mindfulness techniques that I still use daily.",
    sessionType: "Video Call",
    helpful: 20,
  },
]

const similarExperts = [
  {
    id: 5,
    name: "Dr. Michael Torres",
    type: "coaching",
    specialty: "Career & Executive Coach",
    avatar: "/placeholder.svg?height=60&width=60",
    rating: 4.8,
    sessions: 892,
    priceFrom: 40,
  },
  {
    id: 6,
    name: "Dr. Amanda Wilson",
    type: "coaching",
    specialty: "Relationship Therapist",
    avatar: "/placeholder.svg?height=60&width=60",
    rating: 4.7,
    sessions: 1156,
    priceFrom: 30,
  },
  {
    id: 7,
    name: "Prof. James Park",
    type: "coaching",
    specialty: "Mindfulness & Meditation Expert",
    avatar: "/placeholder.svg?height=60&width=60",
    rating: 4.9,
    sessions: 743,
    priceFrom: 25,
  },
]

export default function CloneProfilePage() {
  const [selectedTab, setSelectedTab] = useState("overview")
  const typeConfig = expertTypes[expert.type as keyof typeof expertTypes]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Navigation */}
      <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4 sm:space-x-8">
              <Link
                href="/"
                className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent"
              >
                CloneAI
              </Link>
              <div className="hidden md:flex space-x-6">
                <Link
                  href="/discover"
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Discover
                </Link>
                <Link
                  href="/how-it-works"
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  How it Works
                </Link>
                <Link
                  href="/pricing"
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Pricing
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/create-clone">
                <Button variant="ghost" className="hidden sm:inline-flex">
                  Become a Creator
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="outline" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Profile</span>
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="sm">Dashboard</Button>
              </Link>
              <Button variant="ghost" size="sm">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Expert Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-start lg:space-x-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 mb-6 lg:mb-0">
              <div className="relative">
                <Avatar className="h-24 w-24 sm:h-32 sm:w-32">
                  <AvatarImage src={expert.avatar || "/placeholder.svg"} alt={expert.name} />
                  <AvatarFallback className="text-xl sm:text-2xl">
                    {expert.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-2 -right-2 ${typeConfig.color} rounded-full p-2`}>
                  <typeConfig.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{expert.name}</h1>
                  {expert.featured && (
                    <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">Featured Expert</Badge>
                  )}
                </div>
                <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-4">{expert.specialty}</p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                  <div className="flex items-center justify-center sm:justify-start space-x-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    <span className="font-medium">{expert.rating}</span>
                    <span className="text-slate-500">({expert.sessions} sessions)</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start space-x-1">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span>Responds in {expert.responseTime}</span>
                  </div>
                  <Badge variant="secondary" className={`${typeConfig.color} text-white`}>
                    {typeConfig.name}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-3 w-full lg:min-w-[280px]">
              <Link href={`/chat/${expert.id}?demo=true`}>
                <Button size="lg" variant="outline" className="w-full justify-center bg-transparent">
                  <Play className="mr-2 h-4 w-4" />
                  Try Free Demo (3 min)
                </Button>
              </Link>
              <Link href={`/chat/${expert.id}`}>
                <Button size="lg" className="w-full justify-center">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Start Text Chat - </span>${expert.pricing.text.min}/session
                </Button>
              </Link>
              <Link href={`/voice/${expert.id}`}>
                <Button size="lg" variant="secondary" className="w-full justify-center">
                  <Mic className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Voice Session - </span>${expert.pricing.voice.min}/session
                </Button>
              </Link>
              <Link href={`/video/${expert.id}`}>
                <Button size="lg" variant="secondary" className="w-full justify-center">
                  <Video className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Video Call - </span>${expert.pricing.video.min}/session
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="overview" className="text-xs sm:text-sm">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="expertise" className="text-xs sm:text-sm">
                  Expertise
                </TabsTrigger>
                <TabsTrigger value="reviews" className="text-xs sm:text-sm">
                  Reviews
                </TabsTrigger>
                <TabsTrigger value="pricing" className="text-xs sm:text-sm">
                  Pricing
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>About Dr. Sarah Chen</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{expert.bio}</p>

                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
                        Credentials & Qualifications
                      </h3>
                      <div className="space-y-2">
                        {expert.credentials.map((credential, index) => (
                          <div key={index} className="flex items-start space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
                              {credential}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Languages</h3>
                      <div className="flex flex-wrap gap-2">
                        {expert.languages.map((language, index) => (
                          <Badge key={index} variant="outline">
                            {language}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="expertise" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Areas of Expertise</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {expert.expertise.map((area, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                        >
                          <div className={`${typeConfig.color} rounded-full p-1`}>
                            <CheckCircle className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-sm sm:text-base text-slate-700 dark:text-slate-300">{area}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                      <span>User Reviews</span>
                      <div className="flex items-center space-x-2">
                        <Star className="h-5 w-5 text-yellow-500 fill-current" />
                        <span className="font-semibold">{expert.rating}</span>
                        <span className="text-slate-500">({expert.sessions} reviews)</span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="border-b border-slate-200 dark:border-slate-700 last:border-b-0 pb-6 last:pb-0"
                      >
                        <div className="flex items-start space-x-3 sm:space-x-4">
                          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                            <AvatarImage src={review.avatar || "/placeholder.svg"} alt={review.user} />
                            <AvatarFallback>{review.user[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 space-y-1 sm:space-y-0">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-slate-900 dark:text-white">{review.user}</span>
                                <Badge variant="outline" className="text-xs">
                                  {review.sessionType}
                                </Badge>
                              </div>
                              <span className="text-sm text-slate-500">{review.date}</span>
                            </div>
                            <div className="flex items-center space-x-1 mb-2">
                              {[...Array(review.rating)].map((_, i) => (
                                <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                              ))}
                            </div>
                            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-2">
                              {review.content}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-slate-500">
                              <button className="hover:text-slate-700 dark:hover:text-slate-300">
                                👍 Helpful ({review.helpful})
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pricing" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Session Pricing</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <MessageCircle className="h-5 w-5 text-blue-500" />
                          <h3 className="font-semibold">Text Chat</h3>
                        </div>
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">
                          ${expert.pricing.text.min}-${expert.pricing.text.max}
                        </div>
                        <p className="text-sm text-slate-500 mb-4">{expert.pricing.text.duration}</p>
                        <Link href={`/chat/${expert.id}`}>
                          <Button className="w-full">Start Chat</Button>
                        </Link>
                      </div>

                      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <Mic className="h-5 w-5 text-green-500" />
                          <h3 className="font-semibold">Voice Call</h3>
                        </div>
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">
                          ${expert.pricing.voice.min}-${expert.pricing.voice.max}
                        </div>
                        <p className="text-sm text-slate-500 mb-4">{expert.pricing.voice.duration}</p>
                        <Link href={`/voice/${expert.id}`}>
                          <Button className="w-full" variant="secondary">
                            Start Call
                          </Button>
                        </Link>
                      </div>

                      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <Video className="h-5 w-5 text-purple-500" />
                          <h3 className="font-semibold">Video Call</h3>
                        </div>
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">
                          ${expert.pricing.video.min}-${expert.pricing.video.max}
                        </div>
                        <p className="text-sm text-slate-500 mb-4">{expert.pricing.video.duration}</p>
                        <Link href={`/video/${expert.id}`}>
                          <Button className="w-full" variant="secondary">
                            Start Video
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Pricing Notes</h4>
                      <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                        <li>• Sessions are billed per minute after the first 5 minutes</li>
                        <li>• You can end the session at any time</li>
                        <li>• Unused session time is not refunded</li>
                        <li>• All payments are processed securely</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Total Sessions</span>
                  <span className="font-semibold">{expert.sessions.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Average Rating</span>
                  <div className="flex items-center space-x-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    <span className="font-semibold">{expert.rating}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Response Time</span>
                  <span className="font-semibold text-green-600">{expert.responseTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Availability</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {expert.availability}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Similar Experts */}
            <Card>
              <CardHeader>
                <CardTitle>Similar Experts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {similarExperts.map((similarExpert) => {
                  const similarTypeConfig = expertTypes[similarExpert.type as keyof typeof expertTypes]
                  return (
                    <Link key={similarExpert.id} href={`/clone/${similarExpert.id}`}>
                      <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        <div className="relative">
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                            <AvatarImage src={similarExpert.avatar || "/placeholder.svg"} alt={similarExpert.name} />
                            <AvatarFallback>
                              {similarExpert.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-1 -right-1 ${similarTypeConfig.color} rounded-full p-1`}>
                            <similarTypeConfig.icon className="h-3 w-3 text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">{similarExpert.name}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                            {similarExpert.specialty}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <div className="flex items-center space-x-1">
                              <Star className="h-3 w-3 text-yellow-500 fill-current" />
                              <span className="text-xs">{similarExpert.rating}</span>
                            </div>
                            <span className="text-xs text-slate-500">From ${similarExpert.priceFrom}</span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      </div>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
