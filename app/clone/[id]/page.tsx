"use client"

import { useState, useEffect } from "react"
import { useParams } from 'next/navigation'
import { getClone, type CloneResponse } from '@/lib/clone-api'
import { useAuth } from '@/contexts/auth-context'
import { toast } from '@/components/ui/use-toast'
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

// Mock reviews data - in a real app, these would come from API
const getExampleReviews = (expertName: string) => [
  {
    id: 1,
    user: "Jennifer M.",
    avatar: "/placeholder.svg?height=40&width=40",
    rating: 5,
    date: "2 days ago",
    content: `${expertName}'s AI clone provided incredibly insightful guidance. The conversation felt natural and the advice was practical and actionable. Highly recommend!`,
    sessionType: "Text Chat",
    helpful: 12,
  },
  {
    id: 2,
    user: "Michael R.",
    avatar: "/placeholder.svg?height=40&width=40",
    rating: 5,
    date: "1 week ago",
    content: `Amazing experience! The voice session felt authentic. ${expertName}'s clone helped me work through complex issues with great empathy and professional insight.`,
    sessionType: "Voice Call",
    helpful: 8,
  },
  {
    id: 3,
    user: "Lisa K.",
    avatar: "/placeholder.svg?height=40&width=40",
    rating: 4,
    date: "2 weeks ago",
    content: `Very helpful for developing strategies. The clone remembered our previous conversations and built upon them effectively. Great value for the price.`,
    sessionType: "Text Chat",
    helpful: 15,
  },
]

// Mock similar experts - in a real app, these would come from API based on category
const getSimilarExperts = (category: string) => [
  {
    id: 'similar-1',
    name: "AI Expert Assistant",
    type: category,
    specialty: "Professional Consultant",
    avatar: "/placeholder.svg?height=60&width=60",
    rating: 4.8,
    sessions: 892,
    priceFrom: 40,
  },
  {
    id: 'similar-2', 
    name: "Expert Helper",
    type: category,
    specialty: "Specialized Advisor",
    avatar: "/placeholder.svg?height=60&width=60",
    rating: 4.7,
    sessions: 1156,
    priceFrom: 30,
  },
  {
    id: 'similar-3',
    name: "Professional Guide",
    type: category,
    specialty: "Industry Specialist",
    avatar: "/placeholder.svg?height=60&width=60",
    rating: 4.6,
    sessions: 743,
    priceFrom: 25,
  },
]

export default function CloneProfilePage() {
  const params = useParams()
  const { user } = useAuth()
  const [selectedTab, setSelectedTab] = useState("overview")
  const [expert, setExpert] = useState<ExpertData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
      } catch (error) {
        console.error('Failed to fetch clone:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setError(`Failed to load clone profile: ${errorMessage}`)
        toast({
          title: "Error",
          description: `Failed to load clone profile: ${errorMessage}`,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300">Loading clone profile...</p>
        </div>
      </div>
    )
  }

  if (error || !expert) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Clone Not Found</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-4">{error || 'The requested clone could not be found.'}</p>
          <Link href="/discover">
            <Button>Browse Other Clones</Button>
          </Link>
        </div>
      </div>
    )
  }

  const typeConfig = expertTypes[expert.type as keyof typeof expertTypes] || expertTypes.coaching

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

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
                  {!expert.is_published && (
                    <Badge variant="secondary">Draft</Badge>
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
              {expert.is_published ? (
                <>
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
                </>
              ) : (
                <div className="text-center p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <p className="text-slate-600 dark:text-slate-300 mb-2">This clone is not yet published</p>
                  {user && user.id === expert.creator_id && (
                    <Link href={`/dashboard/creator`}>
                      <Button variant="outline" size="sm">
                        Edit Clone
                      </Button>
                    </Link>
                  )}
                </div>
              )}
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
                    <CardTitle>About {expert.name}</CardTitle>
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
                    {getExampleReviews(expert.name).map((review) => (
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
                {getSimilarExperts(expert.type).map((similarExpert) => {
                  const similarTypeConfig = expertTypes[similarExpert.type as keyof typeof expertTypes] || expertTypes.coaching
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
