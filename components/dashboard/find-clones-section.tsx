"use client"

import { useState, useEffect } from "react"
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { toast } from '@/components/ui/use-toast'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  Star,
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
  Cpu,
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
  ai: { color: "bg-cyan-600", icon: Cpu, name: "AI" },
}

interface ExpertData {
  id: string;
  name: string;
  description: string;
  category: string;
  base_price: number;
  avatar_url?: string;
  total_sessions: number;
  average_rating: number;
  expertise_areas?: string[];
  type: string;
  specialty: string;
  sessions: number;
  rating: number;
  priceFrom: number;
  priceTo: number;
  avatar: string;
  featured?: boolean;
  credentials: string[];
  availability: string;
}

export default function FindClonesSection() {
  const { isAuthenticated } = useAuth()
  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [clones, setClones] = useState<ExpertData[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch all published clones from Supabase
  useEffect(() => {
    const fetchClones = async () => {
      try {
        setLoading(true)
        
        // Build Supabase query - fetch ALL published clones (no pagination limit)
        let query = supabase
          .from('clones')
          .select('*')
          .eq('is_active', true)
          .eq('is_published', true) // Only show published clones

        // Add category filter
        if (selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory)
        }

        // Add search filter
        if (searchQuery.trim()) {
          const searchTerm = searchQuery.trim()
          query = query.or(
            `name.ilike.%${searchTerm}%,` +
            `bio.ilike.%${searchTerm}%,` +
            `category.ilike.%${searchTerm}%,` +
            `professional_title.ilike.%${searchTerm}%`
          )
        }

        // Order by created_at descending
        query = query.order('created_at', { ascending: false })

        const { data: clonesData, error } = await query

        if (error) {
          throw error
        }

        // Transform clone data to match our interface
        const transformedClones: ExpertData[] = (clonesData || []).map((clone, index) => {
          const basePrice = parseFloat(clone.base_price) || 25
          const rating = parseFloat(clone.average_rating) || 0
          
          return {
            id: clone.id,
            name: clone.name,
            description: clone.bio || clone.professional_title || clone.description || 'Expert AI Clone',
            category: clone.category,
            base_price: basePrice,
            avatar_url: clone.avatar_url,
            total_sessions: clone.total_sessions || 0,
            average_rating: rating,
            expertise_areas: clone.expertise_areas || [],
            // Transform to match ExpertData interface
            type: clone.category,
            specialty: clone.professional_title || clone.description || `${clone.category} Expert`,
            sessions: clone.total_sessions || 0,
            rating: rating,
            priceFrom: basePrice,
            priceTo: Math.floor(basePrice * 1.5),
            avatar: clone.avatar_url || `/placeholder.svg?height=80&width=80`,
            featured: index < 3, // Make first 3 featured
            credentials: [
              ...(clone.expertise_areas?.slice(0, 2) || []),
              ...(clone.credentials_qualifications ? [clone.credentials_qualifications.split(',')[0].trim()] : ['Expert Professional'])
            ].slice(0, 3),
            availability: 'Available now',
          }
        })

        console.log('Fetched clones for dashboard:', clonesData?.length || 0)
        setClones(transformedClones)
      } catch (error) {
        console.error('Failed to fetch clones:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        toast({
          title: "Failed to load clones",
          description: errorMessage,
          variant: "destructive",
        })
        setClones([])
      } finally {
        setLoading(false)
      }
    }

    fetchClones()
  }, [selectedCategory, searchQuery])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Find & Start Sessions with AI Clones</h2>
        <p className="text-lg text-slate-600 dark:text-slate-300">Discover and connect with expert AI clones</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
          <Input
            type="text"
            placeholder="Search clones by name or specialty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-4 py-3 text-lg rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
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
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-slate-600 dark:text-slate-300">
          {loading ? "Loading..." : `${clones.length} expert${clones.length !== 1 ? "s" : ""} found`}
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-300">Loading AI experts...</p>
          </div>
        </div>
      )}

      {/* Clones Grid */}
      {!loading && clones.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clones.map((expert, index) => {
            const typeConfig = expertTypes[expert.type as keyof typeof expertTypes]
            return (
              <motion.div
                key={expert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <Link href={`/session/${expert.id}`}>
                  <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-slate-300 dark:hover:border-slate-600 h-full">
                    <div className="relative p-4">
                      {expert.featured && (
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                            Featured
                          </Badge>
                        </div>
                      )}
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
      )}

      {/* No Results */}
      {!loading && clones.length === 0 && (
        <div className="text-center py-12">
          <div className="text-slate-400 mb-4">
            <Search className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No clones found</h3>
          <p className="text-slate-600 dark:text-slate-300">
            Try adjusting your search criteria or browse all categories
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setSearchQuery("")
              setSelectedCategory("all")
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  )
}