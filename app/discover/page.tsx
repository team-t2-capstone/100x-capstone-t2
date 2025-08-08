"use client"

import { useState, useMemo, useEffect } from "react"
import { listClones, type CloneResponse } from '@/lib/clone-api'
import { useAuth } from '@/contexts/auth-context'
import { toast } from '@/components/ui/use-toast'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  Search,
  Star,
  Grid,
  List,
  Stethoscope,
  Briefcase,
  GraduationCap,
  DollarSign,
  Heart,
  Scale,
  MessageCircle,
  Mic,
  Video,
  Loader2,
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

const allExperts = [
  {
    id: 1,
    name: "Dr. Sarah Chen",
    type: "coaching",
    specialty: "Life Coach & Therapist",
    avatar: "/placeholder.svg?height=80&width=80",
    heroImage: "/placeholder.svg?height=300&width=400&text=Dr.+Sarah+Chen",
    rating: 4.9,
    sessions: 1247,
    priceFrom: 25,
    priceTo: 75,
    description:
      "Transform your mindset and achieve lasting personal growth with evidence-based therapeutic approaches.",
    credentials: ["PhD Psychology", "Licensed Therapist", "15+ years experience"],
    availability: "online",
    featured: true,
  },
  {
    id: 2,
    name: "Marcus Rodriguez",
    type: "business",
    specialty: "Business Strategy Consultant",
    avatar: "/placeholder.svg?height=80&width=80",
    heroImage: "/placeholder.svg?height=300&width=400&text=Marcus+Rodriguez",
    rating: 4.8,
    sessions: 892,
    priceFrom: 75,
    priceTo: 150,
    description: "Scale your business with proven strategic frameworks used by Fortune 500 companies.",
    credentials: ["MBA Harvard", "Ex-McKinsey", "20+ years experience"],
    availability: "online",
    featured: true,
  },
  {
    id: 3,
    name: "Prof. Emma Watson",
    type: "education",
    specialty: "Data Science Educator",
    avatar: "/placeholder.svg?height=80&width=80",
    heroImage: "/placeholder.svg?height=300&width=400&text=Prof.+Emma+Watson",
    rating: 4.9,
    sessions: 2156,
    priceFrom: 35,
    priceTo: 85,
    description: "Master data science with personalized learning paths and hands-on projects.",
    credentials: ["PhD Computer Science", "Stanford Professor", "Published Author"],
    availability: "online",
    featured: true,
  },
  {
    id: 4,
    name: "David Kim",
    type: "medical",
    specialty: "Fitness & Nutrition Expert",
    avatar: "/placeholder.svg?height=80&width=80",
    rating: 4.7,
    sessions: 1543,
    priceFrom: 20,
    priceTo: 60,
    description: "Achieve optimal health through science-based fitness and nutrition strategies.",
    credentials: ["MS Exercise Science", "Certified Nutritionist", "Olympic Trainer"],
    availability: "online",
    featured: false,
  },
  {
    id: 5,
    name: "Lisa Thompson",
    type: "finance",
    specialty: "Financial Planning Advisor",
    avatar: "/placeholder.svg?height=80&width=80",
    rating: 4.8,
    sessions: 967,
    priceFrom: 50,
    priceTo: 120,
    description: "Build wealth and secure your financial future with personalized investment strategies.",
    credentials: ["CFA Charter", "CFP Certified", "12+ years Wall Street"],
    availability: "online",
    featured: false,
  },
  {
    id: 6,
    name: "Dr. Ahmed Hassan",
    type: "medical",
    specialty: "Medical AI Assistant",
    avatar: "/placeholder.svg?height=80&width=80",
    rating: 4.6,
    sessions: 2341,
    priceFrom: 15,
    priceTo: 45,
    description:
      "Get preliminary medical guidance and health information (not a substitute for professional medical advice).",
    credentials: ["MD Internal Medicine", "Board Certified", "AI Health Specialist"],
    availability: "online",
    featured: false,
  },
  {
    id: 7,
    name: "Jennifer Park",
    type: "legal",
    specialty: "Corporate Law Consultant",
    avatar: "/placeholder.svg?height=80&width=80",
    rating: 4.9,
    sessions: 654,
    priceFrom: 100,
    priceTo: 200,
    description: "Navigate complex legal matters with expert guidance on corporate law and compliance.",
    credentials: ["JD Harvard Law", "Partner at BigLaw", "18+ years experience"],
    availability: "online",
    featured: false,
  },
  {
    id: 8,
    name: "Michael Torres",
    type: "education",
    specialty: "Language Learning Expert",
    avatar: "/placeholder.svg?height=80&width=80",
    rating: 4.7,
    sessions: 1876,
    priceFrom: 25,
    priceTo: 55,
    description: "Master new languages with immersive techniques and personalized learning approaches.",
    credentials: ["MA Linguistics", "Polyglot (8 languages)", "Language Institute Director"],
    availability: "online",
    featured: false,
  },
]

interface ExpertData extends CloneResponse {
  featured?: boolean;
  heroImage?: string;
  credentials?: string[];
  availability?: string;
}

export default function DiscoverPage() {
  const { isAuthenticated } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [priceRange, setPriceRange] = useState([0, 200])
  const [sortBy, setSortBy] = useState("featured")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [clones, setClones] = useState<ExpertData[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Fetch clones from API
  useEffect(() => {
    const fetchClones = async () => {
      try {
        setLoading(true)
        const response = await listClones({
          page: currentPage,
          limit: 20,
          category: selectedCategory === 'all' ? undefined : selectedCategory,
          search: searchQuery || undefined,
          price_min: priceRange[0],
          price_max: priceRange[1],
        })

        // Transform clone data to match our interface
        const transformedClones: ExpertData[] = response.clones.map((clone, index) => ({
          ...clone,
          // Add mock data for fields not in API response
          featured: index < 3, // Make first 3 featured
          heroImage: `/placeholder.svg?height=300&width=400&text=${encodeURIComponent(clone.name)}`,
          credentials: clone.expertise_areas?.slice(0, 3) || ['Expert'],
          availability: 'online',
          type: clone.category,
          specialty: clone.description,
          sessions: clone.total_sessions,
          priceFrom: clone.base_price,
          priceTo: Math.floor(clone.base_price * 1.5),
          avatar: clone.avatar_url || `/placeholder.svg?height=80&width=80`,
        }))

        setClones(transformedClones)
        setTotalPages(response.pagination.total_pages)
      } catch (error) {
        console.error('Failed to fetch clones:', error)
        toast({
          title: "Failed to load clones",
          description: "Using demo data instead",
          variant: "destructive",
        })
        // Fall back to mock data
        setClones(allExperts as ExpertData[])
      } finally {
        setLoading(false)
      }
    }

    fetchClones()
  }, [currentPage, selectedCategory, searchQuery, priceRange])

  const filteredExperts = useMemo(() => {
    const filtered = clones.filter((expert) => {
      const matchesSearch =
        expert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expert.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expert.description.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory = selectedCategory === "all" || expert.type === selectedCategory

      const matchesPrice = expert.priceFrom >= priceRange[0] && expert.priceFrom <= priceRange[1]

      return matchesSearch && matchesCategory && matchesPrice
    })

    // Sort experts
    switch (sortBy) {
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating)
        break
      case "price-low":
        filtered.sort((a, b) => a.priceFrom - b.priceFrom)
        break
      case "price-high":
        filtered.sort((a, b) => b.priceFrom - a.priceFrom)
        break
      case "sessions":
        filtered.sort((a, b) => b.sessions - a.sessions)
        break
      case "featured":
      default:
        filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
        break
    }

    return filtered
  }, [searchQuery, selectedCategory, priceRange, sortBy])

  const featuredExperts = filteredExperts.filter((expert) => expert.featured)
  const regularExperts = filteredExperts.filter((expert) => !expert.featured)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">Discover Expert Clones</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">Find the perfect AI expert for your needs</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sm:p-6 mb-8">
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search by name, specialty, or expertise..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-3 text-lg rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
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

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">Price:</span>
              <div className="w-32">
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  max={200}
                  min={0}
                  step={5}
                  className="w-full"
                />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                ${priceRange[0]}-${priceRange[1]}
              </span>
            </div>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="sessions">Most Sessions</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2 ml-auto">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-slate-600 dark:text-slate-300">
            {loading ? "Loading..." : `${filteredExperts.length} expert${filteredExperts.length !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-300">Discovering amazing AI experts...</p>
            </div>
          </div>
        )}

        {/* Featured Experts Section */}
        {!loading && featuredExperts.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">Featured Experts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredExperts.map((expert, index) => {
                const typeConfig = expertTypes[expert.type as keyof typeof expertTypes]
                return (
                  <motion.div
                    key={expert.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <Link href={`/clone/${expert.id}`}>
                      <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-slate-300 dark:hover:border-slate-600 overflow-hidden">
                        <div className="relative">
                          <img
                            src={expert.heroImage || "/placeholder.svg"}
                            alt={expert.name}
                            className="w-full h-48 sm:h-56 object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-4 left-4">
                            <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                              Featured
                            </Badge>
                          </div>
                          <div className={`absolute top-4 right-4 ${typeConfig.color} rounded-full p-2`}>
                            <typeConfig.icon className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-xl font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1">
                                {expert.name}
                              </h3>
                              <p className="text-slate-600 dark:text-slate-300 font-medium">{expert.specialty}</p>
                            </div>
                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                              <AvatarImage src={expert.avatar || "/placeholder.svg"} alt={expert.name} />
                              <AvatarFallback>
                                {expert.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                          </div>

                          <p className="text-slate-600 dark:text-slate-300 mb-4 line-clamp-2 text-sm">
                            {expert.description}
                          </p>

                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              <span className="text-sm font-medium">{expert.rating}</span>
                              <span className="text-sm text-slate-500">({expert.sessions})</span>
                            </div>
                            <Badge variant="secondary" className={`${typeConfig.color} text-white text-xs`}>
                              {typeConfig.name}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-1 mb-4">
                            {expert.credentials.slice(0, 2).map((credential, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {credential}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-xs text-slate-500">
                              <MessageCircle className="h-3 w-3" />
                              <Mic className="h-3 w-3" />
                              <Video className="h-3 w-3" />
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                                ${expert.priceFrom}-${expert.priceTo}
                              </span>
                              <span className="text-sm text-slate-500 block">/session</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* Regular Experts Section */}
        {!loading && regularExperts.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">All Experts</h2>
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
              {regularExperts.map((expert, index) => {
                const typeConfig = expertTypes[expert.type as keyof typeof expertTypes]

                if (viewMode === "list") {
                  return (
                    <motion.div
                      key={expert.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      <Link href={`/clone/${expert.id}`}>
                        <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer">
                          <CardContent className="p-4 sm:p-6">
                            <div className="flex items-start space-x-4 sm:space-x-6">
                              <div className="relative flex-shrink-0">
                                <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                                  <AvatarImage src={expert.avatar || "/placeholder.svg"} alt={expert.name} />
                                  <AvatarFallback>
                                    {expert.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className={`absolute -bottom-1 -right-1 ${typeConfig.color} rounded-full p-1.5`}>
                                  <typeConfig.icon className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                                </div>
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2">
                                  <div className="mb-2 sm:mb-0">
                                    <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                      {expert.name}
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-300 font-medium">{expert.specialty}</p>
                                  </div>
                                  <div className="text-left sm:text-right">
                                    <div className="flex items-center space-x-1 mb-1">
                                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                                      <span className="font-medium">{expert.rating}</span>
                                      <span className="text-sm text-slate-500">({expert.sessions})</span>
                                    </div>
                                    <Badge variant="secondary" className={`${typeConfig.color} text-white`}>
                                      {typeConfig.name}
                                    </Badge>
                                  </div>
                                </div>

                                <p className="text-slate-600 dark:text-slate-300 mb-4 line-clamp-2 text-sm sm:text-base">
                                  {expert.description}
                                </p>

                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                  <div className="flex flex-wrap gap-1">
                                    {expert.credentials.slice(0, 2).map((credential, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {credential}
                                      </Badge>
                                    ))}
                                  </div>
                                  <div className="text-left sm:text-right">
                                    <span className="text-lg font-semibold text-slate-900 dark:text-white">
                                      ${expert.priceFrom}-${expert.priceTo}
                                    </span>
                                    <span className="text-sm text-slate-500 ml-1">/session</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  )
                }

                return (
                  <motion.div
                    key={expert.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <Link href={`/clone/${expert.id}`}>
                      <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-slate-300 dark:hover:border-slate-600 h-full">
                        <CardContent className="p-4 sm:p-6">
                          <div className="flex items-center space-x-4 mb-4">
                            <div className="relative">
                              <Avatar className="h-12 w-12 sm:h-16 sm:w-16">
                                <AvatarImage src={expert.avatar || "/placeholder.svg"} alt={expert.name} />
                                <AvatarFallback>
                                  {expert.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div className={`absolute -bottom-1 -right-1 ${typeConfig.color} rounded-full p-1.5`}>
                                <typeConfig.icon className="h-3 w-3 text-white" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                {expert.name}
                              </h3>
                              <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{expert.specialty}</p>
                            </div>
                          </div>

                          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-3">
                            {expert.description}
                          </p>

                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              <span className="text-sm font-medium">{expert.rating}</span>
                              <span className="text-sm text-slate-500">({expert.sessions})</span>
                            </div>
                            <Badge variant="secondary" className={`${typeConfig.color} text-white text-xs`}>
                              {typeConfig.name}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-1 mb-4">
                            {expert.credentials.slice(0, 2).map((credential, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {credential}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-xs text-slate-500">
                              <MessageCircle className="h-3 w-3" />
                              <Mic className="h-3 w-3" />
                              <Video className="h-3 w-3" />
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                                ${expert.priceFrom}-${expert.priceTo}
                              </span>
                              <span className="text-sm text-slate-500 block">/session</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && filteredExperts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-slate-400 mb-4">
              <Search className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No experts found</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Try adjusting your search criteria or browse all categories
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("all")
                setPriceRange([0, 200])
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center mt-12 space-x-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="bg-transparent"
            >
              Previous
            </Button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
              return (
                <Button
                  key={pageNumber}
                  variant={currentPage === pageNumber ? "default" : "outline"}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={currentPage === pageNumber ? "" : "bg-transparent"}
                >
                  {pageNumber}
                </Button>
              )
            })}
            
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="bg-transparent"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
