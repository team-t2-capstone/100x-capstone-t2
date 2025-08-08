"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { CheckCircle, X, MessageCircle, Mic, Video, Star, Users, Clock, Shield, Zap, ArrowRight } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

const userPlans = [
  {
    name: "Free Trial",
    price: { monthly: 0, yearly: 0 },
    description: "Try CloneAI with limited access",
    features: [
      "3 free demo sessions per month",
      "Text chat only",
      "Basic expert selection",
      "Standard response time",
      "Session transcripts",
    ],
    limitations: [
      "No voice or video calls",
      "Limited to 5 minutes per session",
      "No session recordings",
      "Basic support only",
    ],
    popular: false,
    cta: "Start Free Trial",
  },
  {
    name: "Essential",
    price: { monthly: 29, yearly: 290 },
    description: "Perfect for occasional expert consultations",
    features: [
      "50 session credits per month",
      "Text, voice, and video sessions",
      "Access to all expert categories",
      "Priority response time",
      "Session recordings & transcripts",
      "Email support",
    ],
    limitations: ["Credits don't roll over", "Standard booking priority"],
    popular: false,
    cta: "Get Essential",
  },
  {
    name: "Professional",
    price: { monthly: 79, yearly: 790 },
    description: "For regular users who need consistent expert access",
    features: [
      "150 session credits per month",
      "All Essential features",
      "Rollover up to 50 unused credits",
      "Premium expert access",
      "Advanced session analytics",
      "Priority booking",
      "Phone & chat support",
    ],
    limitations: [],
    popular: true,
    cta: "Get Professional",
  },
  {
    name: "Enterprise",
    price: { monthly: 199, yearly: 1990 },
    description: "For teams and organizations",
    features: [
      "500 session credits per month",
      "All Professional features",
      "Team management dashboard",
      "Custom expert onboarding",
      "API access",
      "Dedicated account manager",
      "24/7 priority support",
      "Custom integrations",
    ],
    limitations: [],
    popular: false,
    cta: "Contact Sales",
  },
]

const sessionPricing = [
  {
    type: "Text Chat",
    icon: MessageCircle,
    priceRange: "$15-50",
    duration: "Per session",
    features: ["Real-time messaging", "Session transcripts", "Basic personality matching", "Standard response time"],
    color: "blue",
  },
  {
    type: "Voice Call",
    icon: Mic,
    priceRange: "$25-75",
    duration: "Per session",
    features: ["Natural voice synthesis", "Audio recordings", "Enhanced personality", "Priority response time"],
    color: "green",
  },
  {
    type: "Video Call",
    icon: Video,
    priceRange: "$40-100",
    duration: "Per session",
    features: ["Realistic avatar", "Full video experience", "Premium personality", "Instant response time"],
    color: "purple",
  },
]

const expertEarnings = [
  {
    tier: "Starter",
    requirements: "New experts, building reputation",
    commission: "70%",
    features: ["Basic profile features", "Standard listing placement", "Monthly payouts", "Email support"],
  },
  {
    tier: "Professional",
    requirements: "50+ sessions, 4.5+ rating",
    commission: "75%",
    features: [
      "Enhanced profile features",
      "Priority listing placement",
      "Weekly payouts",
      "Priority support",
      "Analytics dashboard",
    ],
  },
  {
    tier: "Expert",
    requirements: "200+ sessions, 4.8+ rating",
    commission: "80%",
    features: [
      "Premium profile features",
      "Top listing placement",
      "Daily payouts",
      "Dedicated support",
      "Advanced analytics",
      "Custom branding options",
    ],
  },
]

const faqs = [
  {
    question: "How do session credits work?",
    answer:
      "Each session credit allows you to have one conversation with an expert clone. Credits are consumed based on session length and type. Text sessions use 1 credit, voice sessions use 1.5 credits, and video sessions use 2 credits.",
  },
  {
    question: "What happens to unused credits?",
    answer:
      "On the Essential plan, unused credits expire at the end of each month. Professional and Enterprise plans allow rollover of unused credits up to specified limits.",
  },
  {
    question: "Can I change my plan anytime?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle, and we'll prorate any differences.",
  },
  {
    question: "How much can experts earn?",
    answer:
      "Expert earnings vary based on session volume, pricing, and commission tier. Top experts earn $5,000-15,000+ per month. You keep 70-80% of session fees depending on your tier.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes! New users get 3 free demo sessions to try the platform. Each demo session is limited to 5 minutes and text chat only.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards, PayPal, and bank transfers. Enterprise customers can also pay via invoice.",
  },
]

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
  const [activeTab, setActiveTab] = useState<"users" | "experts">("users")

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6">
              Simple,
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {" "}
                Transparent
              </span>
              <br />
              Pricing
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto">
              Choose the plan that works for you. Whether you're seeking expert advice or sharing your expertise, we
              have flexible options for everyone.
            </p>
          </motion.div>

          {/* Tab Switcher */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center justify-center space-x-4 mb-12"
          >
            <Button
              variant={activeTab === "users" ? "default" : "outline"}
              onClick={() => setActiveTab("users")}
              className={activeTab === "users" ? "" : "bg-transparent"}
            >
              <Users className="h-4 w-4 mr-2" />
              For Users
            </Button>
            <Button
              variant={activeTab === "experts" ? "default" : "outline"}
              onClick={() => setActiveTab("experts")}
              className={activeTab === "experts" ? "" : "bg-transparent"}
            >
              <Star className="h-4 w-4 mr-2" />
              For Experts
            </Button>
          </motion.div>
        </div>
      </section>

      {/* User Pricing */}
      {activeTab === "users" && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Billing Toggle */}
            <div className="flex items-center justify-center space-x-4 mb-12">
              <span
                className={`text-sm ${!isYearly ? "text-slate-900 dark:text-white font-medium" : "text-slate-600 dark:text-slate-300"}`}
              >
                Monthly
              </span>
              <Switch checked={isYearly} onCheckedChange={setIsYearly} />
              <span
                className={`text-sm ${isYearly ? "text-slate-900 dark:text-white font-medium" : "text-slate-600 dark:text-slate-300"}`}
              >
                Yearly
              </span>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Save 17%</Badge>
            </div>

            {/* Subscription Plans */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
              {userPlans.map((plan, index) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Card className={`h-full relative ${plan.popular ? "ring-2 ring-blue-500 shadow-lg" : ""}`}>
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-blue-600 text-white">Most Popular</Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-4">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <div className="mt-4">
                        <span className="text-4xl font-bold text-slate-900 dark:text-white">
                          ${isYearly ? plan.price.yearly : plan.price.monthly}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300">/{isYearly ? "year" : "month"}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{plan.description}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start space-x-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-slate-600 dark:text-slate-300">{feature}</span>
                          </li>
                        ))}
                        {plan.limitations.map((limitation, i) => (
                          <li key={i} className="flex items-start space-x-2 text-sm">
                            <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-slate-500">{limitation}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className={`w-full mt-6 ${plan.popular ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                        variant={plan.popular ? "default" : "outline"}
                      >
                        {plan.cta}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Pay-per-Session Pricing */}
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Pay-per-Session</h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                Prefer to pay as you go? Choose individual sessions with any expert
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {sessionPricing.map((session, index) => (
                <motion.div
                  key={session.type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="text-center">
                      <div
                        className={`w-16 h-16 bg-${session.color}-100 dark:bg-${session.color}-900/30 rounded-full flex items-center justify-center mx-auto mb-4`}
                      >
                        <session.icon className={`h-8 w-8 text-${session.color}-600 dark:text-${session.color}-400`} />
                      </div>
                      <CardTitle className="text-xl">{session.type}</CardTitle>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{session.priceRange}</div>
                      <p className="text-slate-600 dark:text-slate-300">{session.duration}</p>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {session.features.map((feature, i) => (
                          <li key={i} className="flex items-center space-x-2 text-sm">
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
          </div>
        </section>
      )}

      {/* Expert Pricing */}
      {activeTab === "experts" && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Expert Commission Tiers</h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                Earn more as you build your reputation and complete more sessions
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              {expertEarnings.map((tier, index) => (
                <motion.div
                  key={tier.tier}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Card className={`h-full ${index === 1 ? "ring-2 ring-green-500 shadow-lg" : ""}`}>
                    {index === 1 && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-green-600 text-white">Most Common</Badge>
                      </div>
                    )}
                    <CardHeader className="text-center">
                      <CardTitle className="text-xl">{tier.tier}</CardTitle>
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                        {tier.commission}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{tier.requirements}</p>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {tier.features.map((feature, i) => (
                          <li key={i} className="flex items-center space-x-2 text-sm">
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

            {/* Earning Examples */}
            <Card className="mb-16">
              <CardHeader>
                <CardTitle className="text-center">Potential Monthly Earnings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Part-time Expert</h4>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">$1,500-3,000</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">20-40 sessions/month</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Active Expert</h4>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">$5,000-8,000</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">80-120 sessions/month</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Top Expert</h4>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">$10,000+</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">150+ sessions/month</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <Link href="/create-clone/wizard">
                <Button size="lg" className="bg-green-600 hover:bg-green-700">
                  Start Creating Your Clone
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Features Comparison */}
      <section className="py-20 bg-slate-100 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Why Choose CloneAI?</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Built with cutting-edge technology and user experience in mind
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Shield,
                title: "Secure & Private",
                description: "End-to-end encryption for all conversations",
              },
              {
                icon: Zap,
                title: "Instant Responses",
                description: "Get expert advice in seconds, not days",
              },
              {
                icon: Clock,
                title: "24/7 Availability",
                description: "Access experts anytime, anywhere",
              },
              {
                icon: Star,
                title: "Quality Guaranteed",
                description: "All experts verified and continuously monitored",
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">Everything you need to know about our pricing</p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{faq.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 dark:text-slate-300">{faq.answer}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
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
                  Start Free Trial
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
