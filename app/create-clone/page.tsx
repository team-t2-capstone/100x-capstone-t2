"use client"

import { RequireCreator } from '@/components/auth/protected-route';
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowRight, Users, DollarSign, Clock, Star, Play, Zap, Target, Globe, BarChart3 } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

const successStories = [
  {
    name: "Dr. Michael Chen",
    specialty: "Business Strategy",
    avatar: "/placeholder.svg?height=60&width=60",
    monthlyEarnings: 12500,
    sessions: 156,
    rating: 4.9,
    testimonial:
      "Creating my AI clone was the best decision I made. I'm helping more people while earning passive income.",
  },
  {
    name: "Sarah Williams",
    specialty: "Life Coaching",
    avatar: "/placeholder.svg?height=60&width=60",
    monthlyEarnings: 8900,
    sessions: 203,
    rating: 4.8,
    testimonial:
      "My clone works 24/7, helping clients while I sleep. It's scaled my impact beyond what I thought possible.",
  },
  {
    name: "Prof. James Park",
    specialty: "Data Science",
    avatar: "/placeholder.svg?height=60&width=60",
    monthlyEarnings: 15200,
    sessions: 89,
    rating: 4.9,
    testimonial: "Teaching through my AI clone has allowed me to reach students globally. The income is just a bonus.",
  },
]

const benefits = [
  {
    icon: DollarSign,
    title: "Unlimited Earning Potential",
    description: "Keep 80% of all session revenue. Top creators earn $10,000+ monthly.",
    color: "text-green-500",
  },
  {
    icon: Clock,
    title: "Work-Life Balance",
    description: "Your clone works 24/7 while you focus on what matters most to you.",
    color: "text-blue-500",
  },
  {
    icon: Globe,
    title: "Global Reach",
    description: "Help people worldwide without geographical or time zone limitations.",
    color: "text-purple-500",
  },
  {
    icon: Target,
    title: "Scale Your Impact",
    description: "Help thousands of people simultaneously with your expertise.",
    color: "text-orange-500",
  },
  {
    icon: Zap,
    title: "Preserve Your Knowledge",
    description: "Create a lasting legacy of your expertise and wisdom.",
    color: "text-yellow-500",
  },
  {
    icon: BarChart3,
    title: "Passive Income Stream",
    description: "Generate revenue even when you're not actively working.",
    color: "text-indigo-500",
  },
]

const steps = [
  {
    step: 1,
    title: "Setup Your Profile",
    description: "Add your credentials, expertise, and professional background",
    duration: "10 minutes",
  },
  {
    step: 2,
    title: "Train Your Clone",
    description: "Upload documents, answer questions, and define your communication style",
    duration: "2-3 hours",
  },
  {
    step: 3,
    title: "Test & Refine",
    description: "Chat with your clone, test responses, and make improvements",
    duration: "30 minutes",
  },
  {
    step: 4,
    title: "Launch & Earn",
    description: "Publish your clone and start earning from day one",
    duration: "5 minutes",
  },
  {
    step: 5,
    title: "Monitor & Optimize",
    description: "Track performance, gather feedback, and continuously improve",
    duration: "Ongoing",
  },
]

const pricingTiers = [
  {
    expertise: "Emerging Expert",
    description: "0-2 years experience",
    priceRange: "$5-25",
    examples: ["Recent graduates", "New professionals", "Specialized hobbyists"],
  },
  {
    expertise: "Experienced Professional",
    description: "3-10 years experience",
    priceRange: "$25-75",
    examples: ["Mid-level professionals", "Certified specialists", "Industry practitioners"],
  },
  {
    expertise: "Industry Leader",
    description: "10+ years experience",
    priceRange: "$75-150",
    examples: ["Senior executives", "Published authors", "Recognized experts"],
  },
]

function CreateClonePageContent() {
  const [selectedTier, setSelectedTier] = useState(1)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6"
            >
              Turn Your Expertise Into
              <span className="block bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                Passive Income
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto"
            >
              Create an AI version of yourself that works 24/7, helping thousands of people while you earn passive
              income. Join 500+ experts already earning on our platform.
            </motion.p>

            {/* Revenue Calculator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-8 max-w-2xl mx-auto mb-8"
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Potential Monthly Earnings Calculator
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {pricingTiers.map((tier, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedTier(index)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedTier === index
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{tier.expertise}</div>
                    <div className="text-xs text-slate-500 mt-1">{tier.priceRange}/session</div>
                  </button>
                ))}
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">$3,500 - $15,000</div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Estimated monthly earnings based on 100-200 sessions
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4"
            >
              <Link href="/create-clone/wizard">
                <Button size="lg" className="rounded-xl px-8 py-4 text-lg">
                  Start Building Your Clone
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="rounded-xl px-8 py-4 text-lg bg-transparent">
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex items-center justify-center space-x-8 mt-8 text-slate-600 dark:text-slate-300"
            >
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>500+ creators</span>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>$2M+ paid out</span>
              </div>
              <div className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <span>4.9 creator rating</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Why Create an AI Clone?</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Transform your expertise into a scalable, profitable business
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow duration-300">
                  <CardContent className="p-6">
                    <div className={`${benefit.color} mb-4`}>
                      <benefit.icon className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{benefit.title}</h3>
                    <p className="text-slate-600 dark:text-slate-300">{benefit.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-16 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Creator Success Stories</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">Real creators, real results</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {successStories.map((story, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4 mb-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={story.avatar || "/placeholder.svg"} alt={story.name} />
                        <AvatarFallback>
                          {story.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{story.name}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{story.specialty}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ${story.monthlyEarnings.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300">Monthly</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{story.sessions}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300">Sessions</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < Math.floor(story.rating) ? "text-yellow-500 fill-current" : "text-slate-300"}`}
                        />
                      ))}
                      <span className="text-sm text-slate-600 dark:text-slate-300 ml-2">{story.rating}</span>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 text-sm italic">"{story.testimonial}"</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">How It Works for Experts</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">Create your AI clone in 5 simple steps</p>
          </div>

          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="flex items-start space-x-6"
              >
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    {step.step}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                    <Badge variant="outline">{step.duration}</Badge>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-8 max-w-2xl mx-auto">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Total Time Investment</h3>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">Just 2-3 Hours</div>
              <p className="text-slate-600 dark:text-slate-300 mb-6">One-time setup for lifetime earnings potential</p>
              <Link href="/create-clone/wizard">
                <Button size="lg" className="rounded-xl">
                  Start Creating Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing & Revenue */}
      <section className="py-16 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Pricing & Revenue Structure</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">Transparent, creator-friendly pricing</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <Card>
              <CardHeader>
                <CardTitle>For Creators</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Platform Commission</span>
                  <span className="font-semibold text-slate-900 dark:text-white">20%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">You Keep</span>
                  <span className="font-semibold text-green-600 text-xl">80%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Setup Fee</span>
                  <span className="font-semibold text-slate-900 dark:text-white">Free</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Payout Frequency</span>
                  <span className="font-semibold text-slate-900 dark:text-white">Weekly</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing Examples</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Life Coach</span>
                    <span className="font-semibold">$20-40/session</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Business Consultant</span>
                    <span className="font-semibold">$50-100/session</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Medical Q&A</span>
                    <span className="font-semibold">$15-30/session</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Financial Advisor</span>
                    <span className="font-semibold">$40-80/session</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl p-8 text-white max-w-4xl mx-auto">
              <h3 className="text-2xl font-bold mb-4">Ready to Start Earning?</h3>
              <p className="text-xl mb-6 opacity-90">
                Join hundreds of experts already earning passive income with AI clones
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                <Link href="/create-clone/wizard">
                  <Button size="lg" variant="secondary" className="rounded-xl px-8 py-4 text-lg">
                    Create Your Clone Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-xl px-8 py-4 text-lg border-white text-white hover:bg-white hover:text-slate-900 bg-transparent"
                >
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">CloneAI</h3>
              <p className="text-slate-300">Empowering experts to scale their knowledge and impact through AI.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">For Creators</h4>
              <ul className="space-y-2 text-slate-300">
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
                  <Link href="/success-stories" className="hover:text-white transition-colors">
                    Success Stories
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">For Users</h4>
              <ul className="space-y-2 text-slate-300">
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
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-slate-300">
                <li>
                  <Link href="/help" className="hover:text-white transition-colors">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-white transition-colors">
                    Contact Us
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
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400">
            <p>&copy; 2024 CloneAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function CreateClonePage() {
  return (
    <RequireCreator>
      <CreateClonePageContent />
    </RequireCreator>
  );
}
