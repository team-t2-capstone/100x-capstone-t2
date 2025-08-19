"use client"

import { useState } from "react"
import { useCreatorDashboard, useCloneManagement } from "@/hooks/use-dashboard"
import { useAuth } from '@/contexts/auth-context'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  MoreHorizontal,
  Plus,
  Eye,
  Edit,
  Pause,
  Play,
  TrendingUp,
  DollarSign,
  Users,
  Star,
  MessageCircle,
  Mic,
  Video,
  BarChart3,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

const expertTypes = {
  medical: { color: "bg-emerald-500", icon: Users, name: "Health & Wellness" },
  business: { color: "bg-blue-500", icon: Users, name: "Business & Strategy" },
  education: { color: "bg-purple-500", icon: Users, name: "Education & Learning" },
  finance: { color: "bg-amber-500", icon: Users, name: "Finance & Investment" },
  coaching: { color: "bg-orange-500", icon: Users, name: "Life & Coaching" },
  legal: { color: "bg-indigo-900", icon: Users, name: "Legal & Consulting" },
  ai: { color: "bg-cyan-600", icon: Users, name: "AI" },
  other: { color: "bg-slate-600", icon: Users, name: "Other" },
}

// Mock data removed - now using real Supabase data from hooks

// Function to calculate clone completion percentage  
const calculateCloneCompletion = (clone: any): number => {
  let completedSteps = 0
  const totalSteps = 4 // Only count essential steps
  
  // Step 1: Basic Information (25%)
  if (clone.name && clone.professional_title && clone.category && clone.bio) {
    // Also check credentials if provided
    if (clone.credentials_qualifications || clone.expertise_areas?.length > 0) {
      completedSteps++
    }
  }
  
  // Step 2: Q&A Training (25%) 
  // This should only be marked complete if actual Q&A responses exist
  // For now, we'll be strict and not count this unless published
  if (clone.is_published) {
    completedSteps++ // Only count if published (means Q&A was done)
  }
  
  // Step 3: Personality & Style (25%)
  if (clone.personality_traits && Object.keys(clone.personality_traits).length > 0 &&
      clone.communication_style && Object.keys(clone.communication_style).length > 0) {
    completedSteps++
  }
  
  // Step 4: Pricing & Launch (25%)  
  if (clone.base_price && clone.base_price > 0 && clone.is_published) {
    completedSteps++
  }
  
  return Math.round((completedSteps / totalSteps) * 100)
}

export default function CreatorDashboardPage() {
  const { user } = useAuth()
  const [selectedTab, setSelectedTab] = useState("overview")
  
  // Use hooks for real data
  const { 
    analytics, 
    clones, 
    sessions, 
    stats, 
    loading, 
    error, 
    refresh 
  } = useCreatorDashboard(user?.id || '', 30)
  
  const {
    updateCloneStatus,
    deleteClone,
    loading: cloneActionLoading,
    error: cloneActionError
  } = useCloneManagement()

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading creator dashboard...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  
  const handleCloneStatusToggle = async (cloneId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    const success = await updateCloneStatus(cloneId, newStatus)
    if (success) {
      refresh() // Refresh dashboard data
    }
  }
  
  const handleDeleteClone = async (cloneId: string) => {
    if (window.confirm('Are you sure you want to delete this clone? This action cannot be undone.')) {
      try {
        const success = await deleteClone(cloneId)
        if (success) {
          console.log('Clone deleted successfully');
          refresh() // Refresh dashboard data
        } else {
          // Error should be displayed in the cloneActionError state
          console.error('Clone deletion failed');
        }
      } catch (error) {
        console.error('Unexpected error during clone deletion:', error);
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">Creator Dashboard</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">Manage your AI clones and track performance</p>
          
          {/* Clone Action Error Display */}
          {cloneActionError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Action Failed:</strong> {cloneActionError}
                {cloneActionError.includes('authentication') && (
                  <div className="mt-2">
                    <p className="text-sm">Try refreshing the page or logging out and back in.</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="clones">My Clones</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Earnings</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        ${stats?.totalEarnings?.toFixed(2) || '0.00'}
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
                      <MessageCircle className="h-5 w-5 text-blue-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Sessions</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {stats?.totalSessions || 0}
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
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Avg Rating</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {stats?.averageRating?.toFixed(1) || '0.0'}
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
                      <TrendingUp className="h-5 w-5 text-purple-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Growth Rate</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        +{stats?.growthRate?.toFixed(1) || '0.0'}%
                      </div>
                      <p className="text-xs text-slate-500">vs last month</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* My Clones Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>My Clones</span>
                  <Link href="/create-clone/wizard">
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New
                    </Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {clones.slice(0, 3).map((clone, index) => {
                    const typeConfig = expertTypes[clone.type as keyof typeof expertTypes] || expertTypes.other
                    return (
                      <motion.div
                        key={clone.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                      >
                        <Card className="hover:shadow-lg transition-all duration-300">
                          <CardContent className="p-6">
                            <div className="flex items-center space-x-4 mb-4">
                              <div className="relative">
                                <Avatar className="h-12 w-12">
                                  <AvatarImage src={clone.avatar_url || "/placeholder.svg"} alt={clone.name} />
                                  <AvatarFallback>
                                    {clone.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className={`absolute -bottom-1 -right-1 ${typeConfig.color} rounded-full p-1`}>
                                  <typeConfig.icon className="h-3 w-3 text-white" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-slate-900 dark:text-white truncate">{clone.name}</h3>
                                <div className="flex items-center space-x-2">
                                  <Badge
                                    variant={clone.status === "active" ? "default" : "secondary"}
                                    className={
                                      clone.status === "active"
                                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                        : ""
                                    }
                                  >
                                    {clone.status}
                                  </Badge>
                                  {calculateCloneCompletion(clone) < 100 && (
                                    <Badge variant="outline" className="text-xs">
                                      {calculateCloneCompletion(clone)}% Complete
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-300">Sessions:</span>
                                <span className="font-medium">{clone.total_sessions || 0}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-300">Rating:</span>
                                <div className="flex items-center space-x-1">
                                  <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                  <span className="font-medium">{clone.average_rating || 0}</span>
                                </div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-300">Earnings:</span>
                                <span className="font-medium">${clone.total_earnings || '0.00'}</span>
                              </div>
                            </div>

                            <div className="flex space-x-2 mt-4">
                              {calculateCloneCompletion(clone) < 100 ? (
                                <Link href={`/create-clone/wizard?clone_id=${clone.id}`} className="flex-1">
                                  <Button variant="default" size="sm" className="w-full">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Continue Setup
                                  </Button>
                                </Link>
                              ) : (
                                <Link href={`/clone/${clone.id}`} className="flex-1">
                                  <Button variant="outline" size="sm" className="w-full bg-transparent">
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </Button>
                                </Link>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="bg-transparent text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteClone(clone.id)}
                                disabled={cloneActionLoading}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Sessions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sessions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No sessions yet</p>
                    </div>
                  ) : (
                    sessions.slice(0, 5).map((session, index) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={session.userAvatar || "/placeholder.svg"} alt={session.userName} />
                        <AvatarFallback>
                          {session.userName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1">
                          <h3 className="font-medium text-slate-900 dark:text-white">{session.userName}</h3>
                          <span className="text-sm text-slate-500">{session.date}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-slate-600 dark:text-slate-300 mb-2">
                          <span>{session.cloneName}</span>
                          <span>•</span>
                          <span>{session.sessionType}</span>
                          <span>•</span>
                          <span>{session.duration}</span>
                          <span>•</span>
                          <span className="text-green-600 font-medium">${session.earnings}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{session.feedback}</p>
                      </div>

                      <div className="flex items-center space-x-1">
                        {[...Array(session.rating)].map((_, i) => (
                          <Star key={i} className="h-3 w-3 text-yellow-500 fill-current" />
                        ))}
                      </div>
                    </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clones" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">My AI Clones</h2>
              <Link href="/create-clone/wizard">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Clone
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clones.map((clone) => {
                const typeConfig = expertTypes[clone.type as keyof typeof expertTypes] || expertTypes.other
                return (
                  <Card key={clone.id} className="hover:shadow-lg transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={clone.avatar_url || "/placeholder.svg"} alt={clone.name} />
                              <AvatarFallback>
                                {clone.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-1 -right-1 ${typeConfig.color} rounded-full p-1`}>
                              <typeConfig.icon className="h-3 w-3 text-white" />
                            </div>
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">{clone.name}</h3>
                            <Badge
                              variant={clone.status === "active" ? "default" : "secondary"}
                              className={
                                clone.status === "active"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : ""
                              }
                            >
                              {clone.status}
                            </Badge>
                            {calculateCloneCompletion(clone) < 100 && (
                              <Badge variant="outline" className="text-xs">
                                {calculateCloneCompletion(clone)}% Setup
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-300">Total Sessions:</span>
                          <span className="font-medium">{clone.total_sessions || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-300">Rating:</span>
                          <div className="flex items-center space-x-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-current" />
                            <span className="font-medium">{clone.average_rating || 0}</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-300">Total Earnings:</span>
                          <span className="font-medium text-green-600">${clone.total_earnings || '0.00'}</span>
                        </div>
                        {calculateCloneCompletion(clone) < 100 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600 dark:text-slate-300">Setup Progress:</span>
                              <span className="font-medium">{calculateCloneCompletion(clone)}%</span>
                            </div>
                            <Progress value={calculateCloneCompletion(clone)} className="h-2" />
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-300">Last Session:</span>
                          <span className="font-medium">{clone.updated_at ? new Date(clone.updated_at).toLocaleDateString() : 'Never'}</span>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span>Pricing:</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-1">
                            <MessageCircle className="h-3 w-3" />
                            <span>${clone.base_price || 25}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Mic className="h-3 w-3" />
                            <span>${Math.floor((clone.base_price || 25) * 1.5)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Video className="h-3 w-3" />
                            <span>${Math.floor((clone.base_price || 25) * 2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Link href={`/clone/${clone.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full bg-transparent">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-transparent"
                          onClick={() => window.location.href = `/create-clone/wizard?edit=${clone.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-transparent"
                          onClick={() => handleCloneStatusToggle(clone.id, clone.status)}
                          disabled={cloneActionLoading}
                        >
                          {clone.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-transparent text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteClone(clone.id)}
                          disabled={cloneActionLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Performance Overview</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Session Completion Rate</span>
                      <span className="text-sm font-medium">{analytics?.sessionMetrics?.completionRate?.toFixed(0) || '0'}%</span>
                    </div>
                    <Progress value={analytics?.sessionMetrics?.completionRate || 0} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">User Satisfaction</span>
                      <span className="text-sm font-medium">{stats?.averageRating?.toFixed(2) || '0.0'}/5.0</span>
                    </div>
                    <Progress value={(stats?.averageRating || 0) * 20} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Response Accuracy</span>
                      <span className="text-sm font-medium">{analytics?.sessionMetrics?.responseAccuracy?.toFixed(0) || '0'}%</span>
                    </div>
                    <Progress value={analytics?.sessionMetrics?.responseAccuracy || 0} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Repeat Users</span>
                      <span className="text-sm font-medium">{stats?.retentionRate?.toFixed(0) || '0'}%</span>
                    </div>
                    <Progress value={stats?.retentionRate || 0} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Session Types Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <MessageCircle className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Text Chat</span>
                      </div>
                      <span className="text-sm font-medium">{analytics?.sessionTypes?.textChat?.toFixed(0) || '0'}%</span>
                    </div>
                    <Progress value={analytics?.sessionTypes?.textChat || 0} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Mic className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Voice Call</span>
                      </div>
                      <span className="text-sm font-medium">{analytics?.sessionTypes?.voiceCall?.toFixed(0) || '0'}%</span>
                    </div>
                    <Progress value={analytics?.sessionTypes?.voiceCall || 0} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Video className="h-4 w-4 text-purple-500" />
                        <span className="text-sm">Video Call</span>
                      </div>
                      <span className="text-sm font-medium">{analytics?.sessionTypes?.videoCall?.toFixed(0) || '0'}%</span>
                    </div>
                    <Progress value={analytics?.sessionTypes?.videoCall || 0} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">+{stats?.monthlyTrends?.sessionsGrowth?.toFixed(1) || '0.0'}%</div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Sessions Growth</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">+{stats?.monthlyTrends?.revenueGrowth?.toFixed(1) || '0.0'}%</div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Revenue Growth</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">+{stats?.monthlyTrends?.ratingImprovement?.toFixed(2) || '0.00'}</div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Rating Improvement</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="earnings" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                    ${stats?.totalEarnings?.toFixed(2) || '0.00'}
                  </div>
                  <p className="text-sm text-green-600">+{stats?.growthRate?.toFixed(1) || '0.0'}% from last month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Total Lifetime</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">${analytics?.lifetimeEarnings?.toFixed(2) || '0.00'}</div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Since January 2024</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Avg per Session</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">${stats?.totalEarnings && stats?.totalSessions ? (stats.totalEarnings / stats.totalSessions).toFixed(2) : '0.00'}</div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Across all session types</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Earnings by Clone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {clones
                    .filter((clone) => clone.status === "active")
                    .map((clone) => {
                      const typeConfig = expertTypes[clone.type as keyof typeof expertTypes] || expertTypes.other
                      return (
                        <div
                          key={clone.id}
                          className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={clone.avatar_url || "/placeholder.svg"} alt={clone.name} />
                                <AvatarFallback>
                                  {clone.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div className={`absolute -bottom-1 -right-1 ${typeConfig.color} rounded-full p-1`}>
                                <typeConfig.icon className="h-2.5 w-2.5 text-white" />
                              </div>
                            </div>
                            <div>
                              <h3 className="font-medium text-slate-900 dark:text-white">{clone.name}</h3>
                              <p className="text-sm text-slate-600 dark:text-slate-300">{clone.total_sessions || 0} sessions</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-slate-900 dark:text-white">
                              ${clone.total_earnings || '0.00'}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300">Total earned</p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payout Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">Next Payout</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">January 1, 2025</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold text-slate-900 dark:text-white">
                      ${stats?.totalEarnings?.toFixed(2) || '0.00'}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Pending</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full bg-transparent">
                  View Payout History
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
