"use client"

import { RequireAuth } from '@/components/auth/protected-route';
import { useAuth } from '@/contexts/auth-context';
import { useState, useEffect } from "react"
import { createClient } from '@/utils/supabase/client'
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MessageCircle,
  Star,
  CreditCard,
  Heart,
  Plus,
  ArrowRight,
  Stethoscope,
  Briefcase,
  GraduationCap,
  DollarSign,
  Scale,
  Search,
  Mic,
  Video,
  Cpu,
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import FindClonesSection from '@/components/dashboard/find-clones-section'

const expertTypes = {
  medical: { color: "bg-emerald-500", icon: Stethoscope, name: "Health & Wellness" },
  business: { color: "bg-blue-500", icon: Briefcase, name: "Business & Strategy" },
  education: { color: "bg-purple-500", icon: GraduationCap, name: "Education & Learning" },
  finance: { color: "bg-amber-500", icon: DollarSign, name: "Finance & Investment" },
  coaching: { color: "bg-orange-500", icon: Heart, name: "Life & Coaching" },
  legal: { color: "bg-indigo-900", icon: Scale, name: "Legal & Consulting" },
  ai: { color: "bg-cyan-600", icon: Cpu, name: "AI" },
}

// Types for our data
interface DashboardData {
  monthlyStats: {
    totalSessions: number;
    totalSpent: number;
    averageRating: number;
    favoriteCategory: string;
  };
  recentSessions: Array<{
    id: string;
    expertName: string;
    expertType: string;
    avatar: string;
    sessionType: string;
    duration: string;
    cost: number;
    date: string;
    rating: number;
    status: string;
  }>;
  availableClones: Array<{
    id: string;
    name: string;
    type: string;
    specialty: string;
    avatar: string;
    rating: number;
    sessions: number;
    priceFrom: number;
    priceTo: number;
    availability: string;
    featured: boolean;
  }>;
  favoriteClones: Array<{
    id: string;
    name: string;
    type: string;
    specialty: string;
    avatar: string;
    rating: number;
    lastSession: string;
    nextAvailable: string;
  }>;
}

function DashboardPageContent() {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState("overview")
  const [cloneSearchQuery, setCloneSearchQuery] = useState("")
  const [selectedCloneCategory, setSelectedCloneCategory] = useState("all")
  
  // Data state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Initialize Supabase client
  const supabase = createClient()

  // Fetch dashboard data
  useEffect(() => {
    async function fetchDashboardData() {
      if (!user?.id) return

      try {
        setLoading(true)
        setError(null)

        // Get user sessions for stats (without automatic JOIN to avoid FK issues)
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select(`
            id,
            clone_id,
            duration_minutes,
            total_cost,
            user_rating,
            session_type,
            created_at,
            status
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)

        // Initialize empty arrays for error cases
        let sessionsData: any[] = []
        
        if (sessionsError) {
          console.error('Sessions query error:', sessionsError)
          console.error('Sessions error details:', JSON.stringify(sessionsError, null, 2))
          
          // Don't throw error for sessions, continue with empty sessions
          console.warn('Continuing with empty sessions data due to error')
        }

        // Manually fetch clone data for sessions to avoid FK relationship issues
        let sessionsWithClones = sessionsError ? sessionsData : (sessions || [])
        if (sessionsWithClones && sessionsWithClones.length > 0) {
          // Get unique clone IDs from sessions
          const cloneIds = [...new Set(sessionsWithClones.map((s: any) => s.clone_id).filter(Boolean))]
          
          if (cloneIds.length > 0) {
            // Fetch clone data for these IDs
            const { data: sessionClones, error: sessionClonesError } = await supabase
              .from('clones')
              .select('id, name, bio, avatar_url, category')
              .in('id', cloneIds)
            
            if (!sessionClonesError && sessionClones) {
              // Create a map for quick lookup
              const cloneMap = new Map(sessionClones.map((clone: any) => [clone.id, clone]))
              
              // Add clone data to sessions
              sessionsWithClones = sessionsWithClones.map((session: any) => ({
                ...session,
                clones: session.clone_id ? cloneMap.get(session.clone_id) || null : null
              }))
            } else {
              console.warn('Could not fetch clone data for sessions:', sessionClonesError)
            }
          }
        }

        // Get available clones for general dashboard display
        const { data: clones, error: clonesError } = await supabase
          .from('clones')
          .select('*')
          .eq('is_published', true)
          .eq('is_active', true)
          .order('average_rating', { ascending: false })
          .limit(20)

        // Initialize empty array for error case
        let clonesData: any[] = []
        
        if (clonesError) {
          console.error('Clones query error:', clonesError)
          console.error('Clones error details:', JSON.stringify(clonesError, null, 2))
          
          // Don't throw error for clones, continue with empty clones
          console.warn('Continuing with empty clones data due to error')
        }

        console.log('Sessions data:', sessionsWithClones?.length || 0, 'items')
        console.log('Clones data:', (clonesError ? clonesData : clones)?.length || 0, 'items')

        // Calculate monthly stats
        const currentMonth = new Date().getMonth()
        const currentYear = new Date().getFullYear()
        const monthlySessions = sessionsWithClones?.filter((session: any) => {
          const sessionDate = new Date(session.created_at)
          return sessionDate.getMonth() === currentMonth && 
                 sessionDate.getFullYear() === currentYear
        }) || []

        const totalSessions = monthlySessions.length
        const totalSpent = monthlySessions.reduce((sum: number, s: any) => sum + (s.total_cost || 0), 0)
        const averageRating = monthlySessions.length > 0 
          ? monthlySessions.reduce((sum: number, s: any) => sum + (s.user_rating || 0), 0) / monthlySessions.length 
          : 0

        // Get favorite category
        console.log('Processing monthly sessions:', monthlySessions.length)
        const categoryCount = monthlySessions.reduce((acc: any, session: any) => {
          const category = session.clones?.category || 'other'
          acc[category] = (acc[category] || 0) + 1
          return acc
        }, {})
        console.log('Category count:', categoryCount)
        const favoriteCategory = Object.keys(categoryCount).reduce((a, b) => 
          categoryCount[a] > categoryCount[b] ? a : b, 'Life & Coaching'
        )

        // Format recent sessions
        console.log('Processing recent sessions from:', sessionsWithClones?.length || 0, 'total sessions')
        const recentSessions = (sessionsWithClones || []).slice(0, 5).map((session: any) => ({
          id: session.id,
          expertName: session.clones?.name || 'Unknown Expert',
          expertType: getCategoryType(session.clones?.category || 'coaching'),
          avatar: session.clones?.avatar_url || '/placeholder.svg',
          sessionType: formatSessionType(session.session_type),
          duration: `${session.duration_minutes || 0} min`,
          cost: session.total_cost || 0,
          date: formatDate(session.created_at),
          rating: session.user_rating || 5,
          status: session.status || 'completed'
        }))

        // Format available clones
        console.log('Processing available clones from:', (clonesError ? clonesData : clones)?.length || 0, 'total clones')
        const availableClones = (clonesError ? clonesData : (clones || [])).map((clone: any) => ({
          id: clone.id,
          name: clone.name,
          type: getCategoryType(clone.category),
          specialty: clone.bio,
          avatar: clone.avatar_url || '/placeholder.svg',
          rating: clone.average_rating || 0,
          sessions: clone.total_sessions || 0,
          priceFrom: Math.floor(clone.base_price * 0.8),
          priceTo: Math.floor(clone.base_price * 1.2),
          availability: 'Available now',
          featured: clone.total_sessions > 100
        }))

        // Get user's most used clones as favorites
        const cloneUsage = sessionsWithClones?.reduce((acc: any, session: any) => {
          if (session.clones?.id) {
            acc[session.clones.id] = (acc[session.clones.id] || 0) + 1
          }
          return acc
        }, {})

        const favoriteCloneIds = Object.entries(cloneUsage || {})
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([id]) => id)

        const favoriteClones = availableClones.filter((clone: any) => 
          favoriteCloneIds.includes(clone.id)
        ).map((clone: any) => ({
          ...clone,
          lastSession: getLastSessionDate(sessionsWithClones || [], clone.id),
          nextAvailable: 'Available now'
        }))

        console.log('Setting dashboard data with:', {
          monthlyStats: { totalSessions, totalSpent, averageRating, favoriteCategory },
          recentSessionsCount: recentSessions.length,
          availableClonesCount: availableClones.length,
          favoriteClonesCount: favoriteClones.length
        })

        setDashboardData({
          monthlyStats: {
            totalSessions,
            totalSpent,
            averageRating,
            favoriteCategory
          },
          recentSessions,
          availableClones,
          favoriteClones
        })

      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        console.error('Error details:', JSON.stringify(err, null, 2))
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [user?.id])

  // Helper functions
  const getCategoryType = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'Health & Wellness': 'medical',
      'Business & Strategy': 'business', 
      'Education & Learning': 'education',
      'Finance & Investment': 'finance',
      'Life & Coaching': 'coaching',
      'Legal & Consulting': 'legal'
    }
    return categoryMap[category] || 'coaching'
  }

  const formatSessionType = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'chat': 'Text Chat',
      'voice': 'Voice Call',
      'video': 'Video Call'
    }
    return typeMap[type] || 'Text Chat'
  }

  const formatDate = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`
    return `${Math.floor(diffMinutes / 1440)} days ago`
  }

  const getLastSessionDate = (sessions: any[], cloneId: string) => {
    const lastSession = sessions.find(s => s.clones?.id === cloneId)
    return lastSession ? formatDate(lastSession.created_at) : 'Never'
  }

  // Loading and error states
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <div className="text-center">No dashboard data available</div>
      </div>
    )
  }

  const filteredClones = dashboardData.availableClones.filter((clone) => {
    const matchesSearch =
      clone.name.toLowerCase().includes(cloneSearchQuery.toLowerCase()) ||
      clone.specialty.toLowerCase().includes(cloneSearchQuery.toLowerCase())

    const matchesCategory = selectedCloneCategory === "all" || clone.type === selectedCloneCategory

    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">Welcome back, {user?.full_name || 'User'}!</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">Here's your learning and growth journey</p>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="clones">Find Clones</TabsTrigger>
            <TabsTrigger value="sessions">My Sessions</TabsTrigger>
            <TabsTrigger value="favorites">Favorites</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="h-5 w-5 text-blue-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Sessions</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {dashboardData.monthlyStats.totalSessions}
                      </div>
                      <p className="text-xs text-slate-500">This month</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Spent</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        ${dashboardData.monthlyStats.totalSpent}
                      </div>
                      <p className="text-xs text-slate-500">This month</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Avg Rating Given</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {dashboardData.monthlyStats.averageRating}
                      </div>
                      <p className="text-xs text-slate-500">Out of 5.0</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-2">
                      <Heart className="h-5 w-5 text-red-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Favorite Category</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {dashboardData.monthlyStats.favoriteCategory}
                      </div>
                      <p className="text-xs text-slate-500">Most sessions</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Recent Sessions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recent Sessions</span>
                  <Link href="/dashboard?tab=sessions">
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData.recentSessions.map((session, index) => {
                    const typeConfig = expertTypes[session.expertType as keyof typeof expertTypes]
                    return (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                        className="flex items-center space-x-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="relative">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={session.avatar || "/placeholder.svg"} alt={session.expertName} />
                            <AvatarFallback>
                              {session.expertName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-1 -right-1 ${typeConfig.color} rounded-full p-1`}>
                            <typeConfig.icon className="h-3 w-3 text-white" />
                          </div>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-slate-900 dark:text-white">{session.expertName}</h3>
                            <span className="text-sm text-slate-500">{session.date}</span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-300">
                            <span>{session.sessionType}</span>
                            <span>•</span>
                            <span>{session.duration}</span>
                            <span>•</span>
                            <span>${session.cost}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            {[...Array(session.rating)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 text-yellow-500 fill-current" />
                            ))}
                          </div>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            {session.status}
                          </Badge>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Favorites and Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Favorite Experts */}
              <Card>
                <CardHeader>
                  <CardTitle>Favorite Experts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboardData.favoriteClones.map((expert, index) => {
                      const typeConfig = expertTypes[expert.type as keyof typeof expertTypes]
                      return (
                        <motion.div
                          key={expert.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={expert.avatar || "/placeholder.svg"} alt={expert.name} />
                              <AvatarFallback>
                                {expert.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-1 -right-1 ${typeConfig.color} rounded-full p-1`}>
                              <typeConfig.icon className="h-2.5 w-2.5 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate">{expert.name}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{expert.specialty}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <div className="flex items-center space-x-1">
                                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                <span className="text-xs">{expert.rating}</span>
                              </div>
                              <span className="text-xs text-slate-500">•</span>
                              <span className="text-xs text-green-600">{expert.nextAvailable}</span>
                            </div>
                          </div>
                          <Link href={`/clone/${expert.id}`}>
                            <Button size="sm" variant="outline">
                              Chat
                            </Button>
                          </Link>
                        </motion.div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Recommended for You</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboardData.availableClones.slice(0, 3).map((expert, index) => {
                      const typeConfig = expertTypes[expert.type as keyof typeof expertTypes]
                      return (
                        <motion.div
                          key={expert.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={expert.avatar || "/placeholder.svg"} alt={expert.name} />
                              <AvatarFallback>
                                {expert.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-1 -right-1 ${typeConfig.color} rounded-full p-1`}>
                              <typeConfig.icon className="h-2.5 w-2.5 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate">{expert.name}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{expert.specialty}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <div className="flex items-center space-x-1">
                                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                <span className="text-xs">{expert.rating}</span>
                              </div>
                              <span className="text-xs text-slate-500">•</span>
                              <span className="text-xs">From ${expert.priceFrom}</span>
                            </div>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Based on your interests</p>
                          </div>
                          <Link href={`/clone/${expert.id}`}>
                            <Button size="sm" variant="outline">
                              View
                            </Button>
                          </Link>
                        </motion.div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="clones" className="space-y-6">
            <FindClonesSection />
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData.recentSessions.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle className="h-12 w-12 text-slate-400 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No sessions yet</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                      Start your learning journey by chatting with AI experts
                    </p>
                    <Link href="/discover">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Start Your First Session
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.recentSessions.map((session, index) => {
                      const typeConfig = expertTypes[session.expertType as keyof typeof expertTypes]
                      return (
                        <div
                          key={session.id}
                          className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700"
                        >
                          <div className="relative">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={session.avatar || "/placeholder.svg"} alt={session.expertName} />
                              <AvatarFallback>
                                {session.expertName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-1 -right-1 ${typeConfig.color} rounded-full p-1`}>
                              <typeConfig.icon className="h-3 w-3 text-white" />
                            </div>
                          </div>

                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1">
                              <h3 className="font-medium text-slate-900 dark:text-white">{session.expertName}</h3>
                              <span className="text-sm text-slate-500">{session.date}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-slate-600 dark:text-slate-300">
                              <span>{session.sessionType}</span>
                              <span>•</span>
                              <span>{session.duration}</span>
                              <span>•</span>
                              <span>${session.cost}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end space-x-2">
                            <div className="flex items-center space-x-1">
                              {[...Array(session.rating)].map((_, i) => (
                                <Star key={i} className="h-3 w-3 text-yellow-500 fill-current" />
                              ))}
                            </div>
                            <Button size="sm" variant="outline">
                              View Details
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="favorites" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Favorite Experts</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData.favoriteClones.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="h-12 w-12 text-slate-400 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No favorites yet</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                      Chat with experts to build your favorites list automatically
                    </p>
                    <Link href="/discover">
                      <Button>
                        <Search className="h-4 w-4 mr-2" />
                        Discover Experts
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboardData.favoriteClones.map((expert) => {
                      const typeConfig = expertTypes[expert.type as keyof typeof expertTypes]
                      return (
                        <div
                          key={expert.id}
                          className="flex items-center space-x-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700"
                        >
                          <div className="relative">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={expert.avatar || "/placeholder.svg"} alt={expert.name} />
                              <AvatarFallback>
                                {expert.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-1 -right-1 ${typeConfig.color} rounded-full p-1`}>
                              <typeConfig.icon className="h-3 w-3 text-white" />
                            </div>
                          </div>

                          <div className="flex-1">
                            <h3 className="font-medium text-slate-900 dark:text-white">{expert.name}</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{expert.specialty}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <div className="flex items-center space-x-1">
                                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                <span className="text-xs">{expert.rating}</span>
                              </div>
                              <span className="text-xs text-slate-500">•</span>
                              <span className="text-xs text-green-600">{expert.nextAvailable}</span>
                            </div>
                          </div>

                          <div className="flex flex-col space-y-2">
                            <Link href={`/clone/${expert.id}`}>
                              <Button size="sm" className="w-full">
                                Chat Now
                              </Button>
                            </Link>
                            <Button size="sm" variant="outline" className="w-full bg-transparent">
                              Remove
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardPageContent />
    </RequireAuth>
  );
}
