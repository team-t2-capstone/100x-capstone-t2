"use client"

import { useState } from "react"
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
  User,
  Plus,
  ArrowRight,
  Stethoscope,
  Briefcase,
  GraduationCap,
  DollarSign,
  Scale,
  Search,
  LogOut,
  Mic,
  Video,
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

const recentSessions = [
  {
    id: 1,
    expertName: "Dr. Sarah Chen",
    expertType: "coaching",
    avatar: "/placeholder.svg?height=40&width=40",
    sessionType: "Text Chat",
    duration: "45 min",
    cost: 37.5,
    date: "2 hours ago",
    rating: 5,
    status: "completed",
  },
  {
    id: 2,
    expertName: "Marcus Rodriguez",
    expertType: "business",
    avatar: "/placeholder.svg?height=40&width=40",
    sessionType: "Voice Call",
    duration: "30 min",
    cost: 75.0,
    date: "1 day ago",
    rating: 5,
    status: "completed",
  },
  {
    id: 3,
    expertName: "Prof. Emma Watson",
    expertType: "education",
    avatar: "/placeholder.svg?height=40&width=40",
    sessionType: "Video Call",
    duration: "60 min",
    cost: 85.0,
    date: "3 days ago",
    rating: 4,
    status: "completed",
  },
]

const favoriteExperts = [
  {
    id: 1,
    name: "Dr. Sarah Chen",
    type: "coaching",
    specialty: "Life Coach & Therapist",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 4.9,
    lastSession: "2 hours ago",
    nextAvailable: "Available now",
  },
  {
    id: 2,
    name: "Marcus Rodriguez",
    type: "business",
    specialty: "Business Strategy Consultant",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 4.8,
    lastSession: "1 day ago",
    nextAvailable: "Available now",
  },
  {
    id: 4,
    name: "David Kim",
    type: "medical",
    specialty: "Fitness & Nutrition Expert",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 4.7,
    lastSession: "1 week ago",
    nextAvailable: "Available in 2 hours",
  },
]

const allAvailableClones = [
  {
    id: 1,
    name: "Dr. Sarah Chen",
    type: "coaching",
    specialty: "Life Coach & Therapist",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 4.9,
    sessions: 1247,
    priceFrom: 25,
    priceTo: 75,
    availability: "Available now",
    featured: true,
  },
  {
    id: 2,
    name: "Marcus Rodriguez",
    type: "business",
    specialty: "Business Strategy Consultant",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 4.8,
    sessions: 892,
    priceFrom: 75,
    priceTo: 150,
    availability: "Available now",
    featured: true,
  },
  {
    id: 3,
    name: "Prof. Emma Watson",
    type: "education",
    specialty: "Data Science Educator",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 4.9,
    sessions: 2156,
    priceFrom: 35,
    priceTo: 85,
    availability: "Available now",
    featured: true,
  },
  {
    id: 4,
    name: "David Kim",
    type: "medical",
    specialty: "Fitness & Nutrition Expert",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 4.7,
    sessions: 1543,
    priceFrom: 20,
    priceTo: 60,
    availability: "Available in 2 hours",
    featured: false,
  },
  {
    id: 5,
    name: "Lisa Thompson",
    type: "finance",
    specialty: "Financial Planning Advisor",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 4.8,
    sessions: 967,
    priceFrom: 50,
    priceTo: 120,
    availability: "Available now",
    featured: false,
  },
]

const recommendations = [
  {
    id: 5,
    name: "Lisa Thompson",
    type: "finance",
    specialty: "Financial Planning Advisor",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 4.8,
    priceFrom: 50,
    reason: "Based on your interest in business strategy",
  },
  {
    id: 6,
    name: "Dr. Ahmed Hassan",
    type: "medical",
    specialty: "Medical AI Assistant",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 4.6,
    priceFrom: 15,
    reason: "Popular in health & wellness",
  },
]

const monthlyStats = {
  totalSessions: 12,
  totalSpent: 487.5,
  averageRating: 4.8,
  favoriteCategory: "Life & Coaching",
}

export default function DashboardPage() {
  const [selectedTab, setSelectedTab] = useState("overview")
  const [cloneSearchQuery, setCloneSearchQuery] = useState("")
  const [selectedCloneCategory, setSelectedCloneCategory] = useState("all")

  const filteredClones = allAvailableClones.filter((clone) => {
    const matchesSearch =
      clone.name.toLowerCase().includes(cloneSearchQuery.toLowerCase()) ||
      clone.specialty.toLowerCase().includes(cloneSearchQuery.toLowerCase())

    const matchesCategory = selectedCloneCategory === "all" || clone.type === selectedCloneCategory

    return matchesSearch && matchesCategory
  })

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
                <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 font-medium">
                  Dashboard
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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">Welcome back, Alex!</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">Here's your learning and growth journey</p>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="clones">Find Clones</TabsTrigger>
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
                        ${monthlyStats.totalSpent}
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
                      <Heart className="h-5 w-5 text-red-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Favorite Category</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {monthlyStats.favoriteCategory}
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
                  {recentSessions.map((session, index) => {
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
                    {favoriteExperts.map((expert, index) => {
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
                    {recommendations.map((expert, index) => {
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
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{expert.reason}</p>
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
            <Card>
              <CardHeader>
                <CardTitle>Find & Start Sessions with AI Clones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <Input
                      placeholder="Search clones by name or specialty..."
                      value={cloneSearchQuery}
                      onChange={(e) => setCloneSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={selectedCloneCategory} onValueChange={setSelectedCloneCategory}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
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

                {/* Clone List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredClones.map((clone) => {
                    const typeConfig = expertTypes[clone.type as keyof typeof expertTypes]
                    return (
                      <Card key={clone.id} className="hover:shadow-lg transition-all duration-300">
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
                              <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                                {clone.name}
                                {clone.featured && (
                                  <Badge className="ml-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs">
                                    Featured
                                  </Badge>
                                )}
                              </h3>
                              <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{clone.specialty}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              <span className="text-sm font-medium">{clone.rating}</span>
                              <span className="text-sm text-slate-500">({clone.sessions})</span>
                            </div>
                            <Badge variant="secondary" className={`${typeConfig.color} text-white text-xs`}>
                              {typeConfig.name}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-green-600">{clone.availability}</span>
                            <div className="text-right">
                              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                                ${clone.priceFrom}-${clone.priceTo}
                              </span>
                              <span className="text-sm text-slate-500 block">/session</span>
                            </div>
                          </div>

                          <div className="flex space-x-2">
                            <Link href={`/chat/${clone.id}`} className="flex-1">
                              <Button className="w-full" size="sm">
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Chat
                              </Button>
                            </Link>
                            <Link href={`/voice/${clone.id}`}>
                              <Button variant="outline" size="sm">
                                <Mic className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/video/${clone.id}`}>
                              <Button variant="outline" size="sm">
                                <Video className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {filteredClones.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No clones found</h3>
                    <p className="text-slate-600 dark:text-slate-300">
                      Try adjusting your search criteria or browse all categories
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentSessions.map((session, index) => {
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="favorites" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Favorite Experts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {favoriteExperts.map((expert) => {
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Billing Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">This Month</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                      ${monthlyStats.totalSpent}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Sessions</span>
                    <span className="font-medium">{monthlyStats.totalSessions}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Average per Session</span>
                    <span className="font-medium">
                      ${(monthlyStats.totalSpent / monthlyStats.totalSessions).toFixed(2)}
                    </span>
                  </div>
                  <Progress value={65} className="mt-4" />
                  <p className="text-sm text-slate-500">65% of monthly budget used</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment Methods</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <CreditCard className="h-8 w-8 text-slate-400" />
                    <div className="flex-1">
                      <p className="font-medium">•••• •••• •••• 4242</p>
                      <p className="text-sm text-slate-500">Expires 12/25</p>
                    </div>
                    <Badge>Primary</Badge>
                  </div>
                  <Button variant="outline" className="w-full bg-transparent">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Payment Method
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2 sm:space-y-0"
                    >
                      <div>
                        <p className="font-medium">{session.expertName}</p>
                        <p className="text-sm text-slate-500">
                          {session.sessionType} • {session.duration}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-medium">${session.cost}</p>
                        <p className="text-sm text-slate-500">{session.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
