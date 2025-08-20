"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  MessageCircle,
  CheckCircle,
  Star,
  Clock,
  Shield,
  Zap,
  Globe,
  ArrowRight,
  Play,
  Upload,
  Settings,
  Rocket,
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

const userSteps = [
  {
    step: 1,
    icon: Search,
    title: "Browse & Discover",
    description: "Explore our curated collection of expert AI clones across various fields and specialties.",
    details: [
      "Search by expertise, rating, or price",
      "Filter by availability and session type",
      "Read reviews and expert credentials",
      "Preview clone personalities and styles",
    ],
  },
  {
    step: 2,
    icon: MessageCircle,
    title: "Connect & Chat",
    description: "Start a conversation via text, voice, or video with your chosen expert clone.",
    details: [
      "Try free 3-minute demo sessions",
      "Choose from text, voice, or video formats",
      "Real-time responses from AI experts",
      "Session recording and transcripts available",
    ],
  },
  {
    step: 3,
    icon: CheckCircle,
    title: "Get Results",
    description: "Receive personalized guidance, actionable insights, and expert advice tailored to your needs.",
    details: [
      "Personalized recommendations and action plans",
      "Follow-up sessions with conversation memory",
      "Downloadable session summaries",
      "Rate and review your experience",
    ],
  },
]

const expertSteps = [
  {
    step: 1,
    icon: Upload,
    title: "Setup Your Profile",
    description: "Add your credentials, expertise, and professional background to create your expert profile.",
    duration: "10 minutes",
  },
  {
    step: 2,
    icon: Settings,
    title: "Train Your Clone",
    description: "Upload documents, answer questions, and define your communication style to train your AI clone.",
    duration: "2-3 hours",
  },
  {
    step: 3,
    icon: Play,
    title: "Test & Refine",
    description: "Test your clone's responses, adjust personality settings, and ensure quality before launch.",
    duration: "30 minutes",
  },
  {
    step: 4,
    icon: Rocket,
    title: "Launch & Earn",
    description: "Publish your clone, set your rates, and start earning from sessions while you sleep.",
    duration: "Ongoing",
  },
]

const features = [
  {
    icon: Shield,
    title: "Privacy & Security",
    description: "End-to-end encryption for all conversations with secure data handling and GDPR compliance.",
  },
  {
    icon: Zap,
    title: "Instant Responses",
    description: "Get immediate expert advice without scheduling conflicts or waiting for appointments.",
  },
  {
    icon: Globe,
    title: "24/7 Availability",
    description: "Access expert knowledge anytime, anywhere, across different time zones and languages.",
  },
  {
    icon: Star,
    title: "Quality Assurance",
    description: "All expert clones are verified, tested, and continuously monitored for accuracy and helpfulness.",
  },
]

const pricingTiers = [
  {
    name: "Basic Sessions",
    price: "$15-50",
    type: "Text Chat",
    features: ["Real-time messaging", "Session transcripts", "Basic personality matching", "Standard response time"],
  },
  {
    name: "Voice Sessions",
    price: "$25-75",
    type: "Voice Call",
    features: ["Natural voice synthesis", "Audio recordings", "Enhanced personality", "Priority response time"],
  },
  {
    name: "Video Sessions",
    price: "$40-100",
    type: "Video Call",
    features: ["Realistic avatar", "Full video experience", "Premium personality", "Instant response time"],
  },
]

const stats = [
  { label: "Expert Clones", value: "500+" },
  { label: "Sessions Completed", value: "50K+" },
  { label: "User Satisfaction", value: "4.9/5" },
  { label: "Response Time", value: "<2s" },
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6">
              How CloneAI
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Works</span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto">
              Connect with AI versions of real experts for instant, personalized advice. Or create your own expert clone
              and earn while you sleep.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16"
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{stat.value}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* For Users Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">For Users</h2>
            <p className="text-xl text-slate-600 dark:text-slate-300">Get expert advice in three simple steps</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {userSteps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="text-center pb-4">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <step.icon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <Badge variant="outline" className="mb-2">
                      Step {step.step}
                    </Badge>
                    <CardTitle className="text-xl">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-slate-600 dark:text-slate-300">{step.description}</p>
                    <ul className="space-y-2">
                      {step.details.map((detail, i) => (
                        <li key={i} className="flex items-start space-x-2 text-sm text-slate-600 dark:text-slate-300">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/discover">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Start Exploring Experts
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* For Experts Section */}
      <section className="py-20 bg-slate-100 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">For Experts</h2>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              Create your AI clone and start earning in four steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {expertSteps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full text-center hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="pb-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                      <step.icon className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <Badge variant="outline" className="mb-2">
                      Step {step.step}
                    </Badge>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-slate-600 dark:text-slate-300 text-sm">{step.description}</p>
                    <div className="flex items-center justify-center space-x-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      <span>{step.duration}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/create-clone/wizard">
              <Button size="lg" className="bg-green-600 hover:bg-green-700">
                Create Your Clone
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Why Choose CloneAI?</h2>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              Built with cutting-edge technology and user experience in mind
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Overview */}
      <section className="py-20 bg-slate-100 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Transparent Pricing</h2>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              Choose the session type that works best for you
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingTiers.map((tier, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{tier.price}</div>
                    <p className="text-slate-600 dark:text-slate-300">{tier.type}</p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span className="text-slate-600 dark:text-slate-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/pricing">
              <Button variant="outline" size="lg">
                View Detailed Pricing
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h2 className="text-4xl font-bold text-white mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-blue-100 mb-8">
              Join thousands of users getting expert advice or experts earning passive income
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/discover">
                <Button size="lg" variant="outline" className="bg-white text-blue-600 hover:bg-blue-50">
                  Find an Expert
                </Button>
              </Link>
              <Link href="/create-clone/wizard">
                <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white">
                  Become an Expert
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">CloneAI</h3>
              <p className="text-slate-300">
                Connecting you with AI versions of real experts for instant, personalized advice.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">For Users</h4>
              <ul className="space-y-2 text-slate-300">
                <li>
                  <Link href="/discover" className="hover:text-white transition-colors">
                    Browse Experts
                  </Link>
                </li>
                <li>
                  <Link href="/how-it-works" className="hover:text-white transition-colors">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">For Experts</h4>
              <ul className="space-y-2 text-slate-300">
                <li>
                  <Link href="/create-clone" className="hover:text-white transition-colors">
                    Create Clone
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/creator" className="hover:text-white transition-colors">
                    Creator Dashboard
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
                    Privacy Policy
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
