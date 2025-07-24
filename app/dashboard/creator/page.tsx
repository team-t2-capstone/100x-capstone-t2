"use client"

import { useState } from "react"
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
  LogOut,
  User,
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
}

const myClones = [
  {
    id: 1,
    name: "Dr. Sarah Chen Clone",
    type: "coaching",
    status: "active",
    avatar: "/placeholder.svg?height=60&width=60",
    sessions: 1247,
    rating: 4.9,
    earnings: 15687.5,
    lastSession: "2 hours ago",
    createdAt: "2024-01-15",
    pricing: { text: 25, voice: 50, video: 75 },
  },
  {
    id: 2,
    name: "Business Strategy Clone",
    type: "business",
    status: "active",
    avatar: "/placeholder.svg?height=60&width=60",
    sessions: 892,
    rating: 4.8,
    earnings: 22340.0,
    lastSession: "1 day ago",
    createdAt: "2024-02-01",
    pricing: { text: 75, voice: 125, video: 150 },
  },
  {
    id: 3,
    name: "Draft Clone",
    type: "education",
    status: "draft",
    avatar: "/placeholder.svg?height=60&width=60",
    sessions: 0,
    rating: 0,
    earnings: 0,
    lastSession: "Never",
    createdAt: "2024-12-01",
    pricing: { text: 35, voice: 65, video: 85 },
  },
]

const recentSessions = [
  {
    id: 1,
    cloneName: "Dr. Sarah Chen Clone",
    userName: "Alex Johnson",
    userAvatar: "/placeholder.svg?height=40&width=40",
    sessionType: "Text Chat",
    duration: "45 min",
    earnings: 37.5,
    rating: 5,
    date: "2 hours ago",
    feedback: "Incredibly helpful session! The advice was spot-on and actionable.",
  },
  {
    id: 2,
    cloneName: "Business Strategy Clone",
    userName: "Maria Garcia",
    userAvatar: "/placeholder.svg?height=40&width=40",
    sessionType: "Voice Call",
    duration: "60 min",
    earnings: 125.0,
    rating: 5,
    date: "1 day ago",
    feedback: "Excellent strategic insights that I can implement immediately.",
  },
  {
    id: 3,
    cloneName: "Dr. Sarah Chen Clone",
    userName: "David Kim",
    userAvatar: "/placeholder.svg?height=40&width=40",
    sessionType: "Video Call",
    duration: "30 min",
    earnings: 75.0,
    rating: 4,
    date: "2 days ago",
    feedback: "Great session, very personalized approach to my situation.",
  },
]

const monthlyStats = {
  totalEarnings: 3847.5,
  totalSessions: 47,
  averageRating: 4.85,
  activeClones: 2,
  growthRate: 23.5,
}

export default function CreatorDashboardPage() {
  const [selectedTab, setSelectedTab] = useState("overview")

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
                <Link href="/dashboard/creator" className="text-blue-600 dark:text-blue-400 font-medium">
                  Creator Dashboard
                </Link>
                <Link
                  href="/dashboard"
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  User Dashboard
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/create-clone/wizard">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Create Clone</span>
                </Button>
              </Link>
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
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">Creator Dashboard</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">Manage your AI clones and track performance</p>
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
                        ${monthlyStats.totalEarnings}
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
                        {monthlyStats.totalSessions}
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
                        {monthlyStats.averageRating}
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
                        +{monthlyStats.growthRate}%
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
                  {myClones.slice(0, 3).map((clone, index) => {
                    const typeConfig = expertTypes[clone.type as keyof typeof expertTypes]
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
                                  <AvatarImage src={clone.avatar || "/placeholder.svg"} alt={clone.name} />
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
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-300">Sessions:</span>
                                <span className="font-medium">{clone.sessions}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-300">Rating:</span>
                                <div className="flex items-center space-x-1">
                                  <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                  <span className="font-medium">{clone.rating}</span>
                                </div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-300">Earnings:</span>
                                <span className="font-medium">${clone.earnings}</span>
                              </div>
                            </div>

                            <div className="flex space-x-2 mt-4">
                              <Link href={`/clone/${clone.id}`} className="flex-1">
                                <Button variant="outline" size="sm" className="w-full bg-transparent">
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </Button>
                              </Link>
                              <Button variant="outline" size="sm" className="bg-transparent">
                                <Edit className="h-4 w-4" />
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
                  {recentSessions.map((session, index) => (
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
                  ))}
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
              {myClones.map((clone) => {
                const typeConfig = expertTypes[clone.type as keyof typeof expertTypes]
                return (
                  <Card key={clone.id} className="hover:shadow-lg transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={clone.avatar || "/placeholder.svg"} alt={clone.name} />
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
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-300">Total Sessions:</span>
                          <span className="font-medium">{clone.sessions}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-300">Rating:</span>
                          <div className="flex items-center space-x-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-current" />
                            <span className="font-medium">{clone.rating}</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-300">Total Earnings:</span>
                          <span className="font-medium text-green-600">${clone.earnings}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-300">Last Session:</span>
                          <span className="font-medium">{clone.lastSession}</span>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span>Pricing:</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-1">
                            <MessageCircle className="h-3 w-3" />
                            <span>${clone.pricing.text}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Mic className="h-3 w-3" />
                            <span>${clone.pricing.voice}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Video className="h-3 w-3" />
                            <span>${clone.pricing.video}</span>
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
                        <Button variant="outline" size="sm" className="bg-transparent">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="bg-transparent">
                          {clone.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
                      <span className="text-sm font-medium">94%</span>
                    </div>
                    <Progress value={94} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">User Satisfaction</span>
                      <span className="text-sm font-medium">4.85/5.0</span>
                    </div>
                    <Progress value={97} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Response Accuracy</span>
                      <span className="text-sm font-medium">91%</span>
                    </div>
                    <Progress value={91} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Repeat Users</span>
                      <span className="text-sm font-medium">67%</span>
                    </div>
                    <Progress value={67} />
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
                      <span className="text-sm font-medium">65%</span>
                    </div>
                    <Progress value={65} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Mic className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Voice Call</span>
                      </div>
                      <span className="text-sm font-medium">25%</span>
                    </div>
                    <Progress value={25} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Video className="h-4 w-4 text-purple-500" />
                        <span className="text-sm">Video Call</span>
                      </div>
                      <span className="text-sm font-medium">10%</span>
                    </div>
                    <Progress value={10} />
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
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">+23.5%</div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Sessions Growth</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">+18.2%</div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Revenue Growth</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">+0.15</div>
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
                    ${monthlyStats.totalEarnings}
                  </div>
                  <p className="text-sm text-green-600">+23.5% from last month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Total Lifetime</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">$38,027.50</div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Since January 2024</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Avg per Session</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">$81.86</div>
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
                  {myClones
                    .filter((clone) => clone.status === "active")
                    .map((clone) => {
                      const typeConfig = expertTypes[clone.type as keyof typeof expertTypes]
                      return (
                        <div
                          key={clone.id}
                          className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={clone.avatar || "/placeholder.svg"} alt={clone.name} />
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
                              <p className="text-sm text-slate-600 dark:text-slate-300">{clone.sessions} sessions</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-slate-900 dark:text-white">
                              ${clone.earnings}
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
                      ${monthlyStats.totalEarnings}
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
