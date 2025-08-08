"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Search,
  Star,
  Users,
  MessageCircle,
  Video,
  Mic,
  ArrowRight,
  Stethoscope,
  Briefcase,
  GraduationCap,
  DollarSign,
  Heart,
  Scale,
  ChevronRight,
  CheckCircle,
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

const featuredExperts = [
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
    description: "Transform your mindset and achieve lasting personal growth",
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
    description: "Scale your business with proven strategic frameworks",
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
    description: "Master data science with personalized learning paths",
  },
  {
    id: 4,
    name: "David Kim",
    type: "medical",
    specialty: "Fitness & Nutrition Expert",
    avatar: "/placeholder.svg?height=80&width=80",
    heroImage: "/placeholder.svg?height=300&width=400&text=David+Kim",
    rating: 4.7,
    sessions: 1543,
    priceFrom: 20,
    description: "Achieve optimal health through science-based approaches",
  },
]

const categories = [
  {
    type: "medical",
    title: "Health & Wellness",
    description: "Medical advice, fitness, nutrition, and mental health support",
    expertCount: 127,
    image: "/placeholder.svg?height=200&width=300",
  },
  {
    type: "business",
    title: "Business & Strategy",
    description: "Strategic planning, leadership, and business growth guidance",
    expertCount: 89,
    image: "/placeholder.svg?height=200&width=300",
  },
  {
    type: "education",
    title: "Education & Learning",
    description: "Academic tutoring, skill development, and knowledge transfer",
    expertCount: 156,
    image: "/placeholder.svg?height=200&width=300",
  },
  {
    type: "finance",
    title: "Finance & Investment",
    description: "Financial planning, investment advice, and wealth management",
    expertCount: 73,
    image: "/placeholder.svg?height=200&width=300",
  },
  {
    type: "coaching",
    title: "Life & Coaching",
    description: "Personal development, career coaching, and life guidance",
    expertCount: 94,
    image: "/placeholder.svg?height=200&width=300",
  },
  {
    type: "legal",
    title: "Legal & Consulting",
    description: "Legal advice, compliance, and professional consulting",
    expertCount: 45,
    image: "/placeholder.svg?height=200&width=300",
  },
]

const testimonials = [
  {
    name: "Jennifer Martinez",
    role: "Startup Founder",
    content: "The business strategy clone helped me pivot my startup and increase revenue by 300% in 6 months.",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 5,
  },
  {
    name: "Michael Chen",
    role: "Software Engineer",
    content: "Learning data science from Prof. Watson's clone was like having a personal tutor available 24/7.",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 5,
  },
  {
    name: "Sarah Johnson",
    role: "Marketing Manager",
    content: "Dr. Chen's life coaching clone helped me overcome burnout and find work-life balance.",
    avatar: "/placeholder.svg?height=50&width=50",
    rating: 5,
  },
]

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">

      {/* Hero Section */}
      <section className="relative py-12 sm:py-20 lg:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 leading-tight"
            >
              Access World-Class Experts,
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Available 24/7
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-6 sm:mb-8 max-w-3xl mx-auto px-4"
            >
              Get personalized guidance from AI versions of leading professionals. Chat, speak, or video call with
              expert clones trained on years of experience.
            </motion.p>

            {/* Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-2xl mx-auto mb-6 sm:mb-8 px-4"
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  type="text"
                  placeholder="What do you need help with today?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-20 sm:pr-24 py-3 sm:py-4 text-base sm:text-lg rounded-2xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400"
                />
                <Button className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-xl text-sm sm:text-base px-3 sm:px-4">
                  Search
                </Button>
              </div>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8 text-slate-600 dark:text-slate-300 text-sm sm:text-base"
            >
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>50,000+ users</span>
              </div>
              <div className="flex items-center space-x-2">
                <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                <span>4.9 average rating</span>
              </div>
              <div className="flex items-center space-x-2">
                <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>1M+ sessions</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Featured Expert Clones */}
      <section className="py-12 sm:py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Featured Expert Clones
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">
              Connect with our most popular AI experts
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {featuredExperts.map((expert, index) => {
              const typeConfig = expertTypes[expert.type as keyof typeof expertTypes]
              return (
                <motion.div
                  key={expert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Link href={`/clone/${expert.id}`}>
                    <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-slate-300 dark:hover:border-slate-600 overflow-hidden h-full">
                      {/* Hero Image */}
                      <div className="relative h-48 sm:h-56 overflow-hidden">
                        <img
                          src={expert.heroImage || "/placeholder.svg"}
                          alt={expert.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs">
                            Featured
                          </Badge>
                        </div>
                        <div className={`absolute top-3 right-3 ${typeConfig.color} rounded-full p-2`}>
                          <typeConfig.icon className="h-4 w-4 text-white" />
                        </div>
                        {/* Avatar overlay */}
                        <div className="absolute bottom-3 left-3">
                          <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
                            <AvatarImage src={expert.avatar || "/placeholder.svg"} alt={expert.name} />
                            <AvatarFallback>
                              {expert.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>

                      <CardContent className="p-4 sm:p-6">
                        <div className="mb-3">
                          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1 line-clamp-1">
                            {expert.name}
                          </h3>
                          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 line-clamp-1">
                            {expert.specialty}
                          </p>
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">
                          {expert.description}
                        </p>

                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            <span className="text-sm font-medium">{expert.rating}</span>
                            <span className="text-xs sm:text-sm text-slate-500">({expert.sessions})</span>
                          </div>
                          <Badge variant="secondary" className={`${typeConfig.color} text-white text-xs`}>
                            {typeConfig.name}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 text-xs text-slate-500">
                            <MessageCircle className="h-3 w-3" />
                            <Mic className="h-3 w-3" />
                            <Video className="h-3 w-3" />
                          </div>
                          <div className="text-right">
                            <span className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                              From ${expert.priceFrom}
                            </span>
                            <span className="text-xs sm:text-sm text-slate-500 block">/session</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              )
            })}
          </div>

          <div className="text-center mt-6 sm:mt-8">
            <Link href="/discover">
              <Button size="lg" className="rounded-xl w-full sm:w-auto">
                Explore All Experts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Browse by Category */}
      <section className="py-12 sm:py-16 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">Browse by Expertise</h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">
              Find the perfect expert for your specific needs
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {categories.map((category, index) => {
              const typeConfig = expertTypes[category.type as keyof typeof expertTypes]
              return (
                <motion.div
                  key={category.type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Link href={`/discover?category=${category.type}`}>
                    <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden h-full">
                      <div className="relative h-40 sm:h-48 overflow-hidden">
                        <img
                          src={category.image || "/placeholder.svg"}
                          alt={category.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className={`absolute top-4 left-4 ${typeConfig.color} rounded-full p-2`}>
                          <typeConfig.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                      </div>
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                            {category.title}
                          </h3>
                          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-shrink-0" />
                        </div>
                        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">
                          {category.description}
                        </p>
                        <div className="flex items-center text-xs sm:text-sm text-slate-500">
                          <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          {category.expertCount} experts available
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">How It Works</h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">
              Get expert guidance in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-center"
            >
              <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
                1. Browse & Discover
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
                Explore our curated collection of expert AI clones across various fields and specialties.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center"
            >
              <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
                2. Connect & Chat
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
                Start a conversation via text, voice, or video with your chosen expert clone.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-center"
            >
              <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">3. Get Results</h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
                Receive personalized guidance, actionable insights, and expert advice tailored to your needs.
              </p>
            </motion.div>
          </div>

          <div className="text-center mt-8 sm:mt-12">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 sm:p-8 max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-4 sm:mb-6 text-sm sm:text-base">
                <div className="flex items-center space-x-2">
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  <span className="font-medium">Text Chat: $5-50/session</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mic className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  <span className="font-medium">Voice: $15-75/session</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Video className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                  <span className="font-medium">Video: $25-150/session</span>
                </div>
              </div>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
                No subscription required • Pay per session • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-12 sm:py-16 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">Success Stories</h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">Real results from real users</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center space-x-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 fill-current" />
                      ))}
                    </div>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-4 sm:mb-6">
                      "{testimonial.content}"
                    </p>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                        <AvatarImage src={testimonial.avatar || "/placeholder.svg"} alt={testimonial.name} />
                        <AvatarFallback>
                          {testimonial.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-white">
                          {testimonial.name}
                        </p>
                        <p className="text-xs sm:text-sm text-slate-500">{testimonial.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* For Experts CTA */}
      <section className="py-12 sm:py-16 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Are you an expert? Share your knowledge at scale
            </h2>
            <p className="text-lg sm:text-xl text-blue-100 mb-6 sm:mb-8 max-w-2xl mx-auto">
              Create an AI version of yourself and earn passive income while helping thousands of people worldwide.
            </p>
            <Link href="/create-clone">
              <Button size="lg" variant="secondary" className="rounded-xl w-full sm:w-auto">
                Create Your Clone
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 text-white py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div className="sm:col-span-2 md:col-span-1">
              <h3 className="text-xl sm:text-2xl font-bold mb-4">CloneAI</h3>
              <p className="text-sm sm:text-base text-slate-300">
                Connect with world-class experts through AI-powered conversations.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">For Users</h4>
              <ul className="space-y-2 text-sm sm:text-base text-slate-300">
                <li>
                  <Link href="/discover" className="hover:text-white transition-colors">
                    Discover Experts
                  </Link>
                </li>
                <li>
                  <Link href="/how-it-works" className="hover:text-white transition-colors">
                    How it Works
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-white transition-colors">
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">For Experts</h4>
              <ul className="space-y-2 text-sm sm:text-base text-slate-300">
                <li>
                  <Link href="/create-clone" className="hover:text-white transition-colors">
                    Create Clone
                  </Link>
                </li>
                <li>
                  <Link href="/creator-guide" className="hover:text-white transition-colors">
                    Creator Guide
                  </Link>
                </li>
                <li>
                  <Link href="/earnings" className="hover:text-white transition-colors">
                    Earnings
                  </Link>
                </li>
                <li>
                  <Link href="/support" className="hover:text-white transition-colors">
                    Support
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm sm:text-base text-slate-300">
                <li>
                  <Link href="/about" className="hover:text-white transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/careers" className="hover:text-white transition-colors">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-white transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white transition-colors">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-6 sm:mt-8 pt-6 sm:pt-8 text-center text-sm sm:text-base text-slate-400">
            <p>&copy; 2024 CloneAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
