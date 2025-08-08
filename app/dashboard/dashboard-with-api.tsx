"use client"

import { RequireAuth } from '@/components/auth/protected-route';
import { useAuth } from '@/contexts/auth-context';
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Loader2,
  AlertCircle,
  TrendingUp,
  Clock,
  BarChart3,
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useUserDashboard, useFavorites } from "@/hooks/use-dashboard"

const expertTypes = {
  medical: { color: "bg-emerald-500", icon: Stethoscope, name: "Health & Wellness" },
  business: { color: "bg-blue-500", icon: Briefcase, name: "Business & Strategy" },
  education: { color: "bg-purple-500", icon: GraduationCap, name: "Education & Learning" },
  finance: { color: "bg-amber-500", icon: DollarSign, name: "Finance & Investment" },
  coaching: { color: "bg-orange-500", icon: Heart, name: "Life & Coaching" },
  legal: { color: "bg-indigo-900", icon: Scale, name: "Legal & Consulting" },
}

function DashboardContent() {
  const { user } = useAuth()
  const [selectedTab, setSelectedTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  
  // Use our custom hooks for real data
  const { 
    analytics, 
    sessions, 
    favorites, 
    stats, 
    loading: dashboardLoading, 
    error: dashboardError,
    refresh: refreshDashboard 
  } = useUserDashboard(user?.id || '', 30)

  const {
    addToFavorites,
    removeFromFavorites,
    loading: favoritesLoading,
    error: favoritesError
  } = useFavorites(user?.id || '')

  // Loading state
  if (dashboardLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (dashboardError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {dashboardError}
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full" 
              onClick={refreshDashboard}
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const handleToggleFavorite = async (cloneId: string, isFavorite: boolean) => {
    if (isFavorite) {
      await removeFromFavorites(cloneId)
    } else {
      await addToFavorites(cloneId)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Welcome back, {user?.name || 'User'}!
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Your AI learning journey continues
          </p>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="find-clones">Find Clones</TabsTrigger>
            <TabsTrigger value="sessions">My Sessions</TabsTrigger>
            <TabsTrigger value="favorites">Favorites</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
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
                        {stats?.totalSessions || 0}
                      </div>
                      <p className="text-xs text-slate-500">All time</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Spent</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        ${stats?.totalSpent?.toFixed(2) || '0.00'}
                      </div>
                      <p className="text-xs text-slate-500">All time</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-purple-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Avg Session</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {stats?.avgSessionDuration?.toFixed(0) || 0}m
                      </div>
                      <p className="text-xs text-slate-500">Average duration</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-orange-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Engagement</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {stats?.engagementScore?.toFixed(0) || 0}%
                      </div>
                      <p className="text-xs text-slate-500">Engagement score</p>
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
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No sessions yet. Start by discovering AI clones!</p>
                    <Link href="/dashboard?tab=find-clones">
                      <Button className="mt-4">
                        Discover Clones
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sessions.slice(0, 3).map((session, index) => {
                      const typeConfig = expertTypes[session.category as keyof typeof expertTypes]
                      return (
                        <motion.div
                          key={session.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.1 }}
                          className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={session.avatar || "/placeholder.svg"} alt={session.cloneName} />
                            <AvatarFallback>
                              {session.cloneName.split(" ").map((n: string) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1">
                              <h3 className="font-medium text-slate-900 dark:text-white">{session.cloneName}</h3>
                              <span className="text-sm text-slate-500">{session.date}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-slate-600 dark:text-slate-300">
                              <span>{session.sessionType}</span>
                              <span>•</span>
                              <span>{session.duration} min</span>
                              <span>•</span>
                              <span className="text-green-600 font-medium">${session.cost}</span>
                            </div>
                          </div>

                          {session.rating && (
                            <div className="flex items-center space-x-1">
                              {[...Array(session.rating)].map((_, i) => (
                                <Star key={i} className="h-3 w-3 text-yellow-500 fill-current" />
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Most Used Clones */}
            {stats?.mostUsedClones && stats.mostUsedClones.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Most Used Clones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.mostUsedClones.slice(0, 3).map((clone, index) => (
                      <div key={clone.clone_id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {clone.clone_name.split(" ").map((n: string) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{clone.clone_name}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{clone.sessions} sessions</p>
                          </div>
                        </div>
                        <Link href={`/clone/${clone.clone_id}`}>
                          <Button variant="outline" size="sm">
                            Chat Again
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Other tabs would be implemented similarly */}
          <TabsContent value="find-clones">
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-slate-500 mb-4">Clone discovery feature coming soon!</p>
                  <p className="text-sm text-slate-400">This will integrate with the discovery API to show available clones.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions">
            <Card>
              <CardHeader>
                <CardTitle>All Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No sessions yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sessions.map((session, index) => (
                      <div
                        key={session.id}
                        className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={session.avatar || "/placeholder.svg"} alt={session.cloneName} />
                          <AvatarFallback>
                            {session.cloneName.split(" ").map((n: string) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1">
                          <h3 className="font-medium text-slate-900 dark:text-white">{session.cloneName}</h3>
                          <div className="text-sm text-slate-600 dark:text-slate-300">
                            {session.sessionType} • {session.duration} min • ${session.cost}
                          </div>
                          <p className="text-sm text-slate-500">{session.date}</p>
                        </div>

                        {session.rating && (
                          <div className="flex items-center space-x-1">
                            {[...Array(session.rating)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 text-yellow-500 fill-current" />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="favorites">
            <Card>
              <CardHeader>
                <CardTitle>Favorite Clones</CardTitle>
              </CardHeader>
              <CardContent>
                {favorites.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Heart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No favorites yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {favorites.map((clone) => (
                      <Card key={clone.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-center space-x-4 mb-4">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={clone.avatar || "/placeholder.svg"} alt={clone.name} />
                              <AvatarFallback>
                                {clone.name.split(" ").map((n: string) => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 dark:text-white">{clone.name}</h3>
                              <p className="text-sm text-slate-600 dark:text-slate-300">{clone.specialty}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              <span className="text-sm">{clone.rating}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleFavorite(clone.id, true)}
                              disabled={favoritesLoading}
                            >
                              <Heart className="h-4 w-4 text-red-500 fill-current" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-slate-500 mb-4">Billing integration coming soon!</p>
                  <p className="text-sm text-slate-400">This will show your payment history and subscription details.</p>
                </div>
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
      <DashboardContent />
    </RequireAuth>
  )
}