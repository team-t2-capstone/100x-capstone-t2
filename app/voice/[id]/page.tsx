"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Phone,
  PhoneOff,
  Clock,
  DollarSign,
  Star,
  MessageCircle,
  Video,
  User,
  LogOut,
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

const expertData = {
  id: 1,
  name: "Dr. Sarah Chen",
  type: "coaching",
  specialty: "Life Coach & Therapist",
  avatar: "/placeholder.svg?height=80&width=80",
  rating: 4.9,
  sessions: 1247,
  pricePerMinute: 1.25,
  description: "Transform your mindset and achieve lasting personal growth with evidence-based therapeutic approaches.",
  credentials: ["PhD Psychology", "Licensed Therapist", "15+ years experience"],
}

export default function VoiceCallPage({ params }: { params: { id: string } }) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [callDuration, setCallDuration] = useState(0)
  const [currentCost, setCurrentCost] = useState(0)
  const [connectionQuality, setConnectionQuality] = useState(95)
  const [isDemo, setIsDemo] = useState(true)
  const [demoTimeLeft, setDemoTimeLeft] = useState(300) // 5 minutes demo

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isConnected) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1)
        setCurrentCost((prev) => prev + expertData.pricePerMinute / 60)

        if (isDemo && demoTimeLeft > 0) {
          setDemoTimeLeft((prev) => prev - 1)
        }
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isConnected, isDemo, demoTimeLeft])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const formatDemoTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleConnect = () => {
    setIsConnecting(true)
    setTimeout(() => {
      setIsConnecting(false)
      setIsConnected(true)
    }, 3000)
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    setCallDuration(0)
    setCurrentCost(0)
    setDemoTimeLeft(300)
  }

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
                <Link
                  href="/dashboard"
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/clone/${params.id}`}
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
          >
            ← Back to Profile
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">Voice Call Session</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">Connect with {expertData.name} via voice</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Call Interface */}
          <div className="lg:col-span-2 space-y-6">
            {/* Call Status Card */}
            <Card className="text-center">
              <CardContent className="p-8">
                {isDemo && (
                  <div className="mb-6">
                    <Badge className="bg-gradient-to-r from-green-400 to-blue-500 text-white text-sm px-4 py-2">
                      🎉 FREE DEMO - {formatDemoTime(demoTimeLeft)} remaining
                    </Badge>
                  </div>
                )}

                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="mb-6"
                >
                  <div className="relative inline-block">
                    <Avatar className="h-32 w-32 mx-auto mb-4">
                      <AvatarImage src={expertData.avatar || "/placeholder.svg"} alt={expertData.name} />
                      <AvatarFallback className="text-2xl">
                        {expertData.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    {isConnected && (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                        className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2"
                      >
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{expertData.name}</h2>
                <p className="text-slate-600 dark:text-slate-300 mb-6">{expertData.specialty}</p>

                {/* Connection Status */}
                <div className="mb-6">
                  {isConnecting && (
                    <div className="space-y-4">
                      <div className="text-lg font-medium text-blue-600 dark:text-blue-400">Connecting...</div>
                      <Progress value={66} className="w-full max-w-xs mx-auto" />
                    </div>
                  )}
                  {isConnected && (
                    <div className="space-y-2">
                      <div className="text-lg font-medium text-green-600">Connected</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatTime(callDuration)}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        Connection Quality: {connectionQuality}%
                      </div>
                    </div>
                  )}
                  {!isConnected && !isConnecting && (
                    <div className="text-lg font-medium text-slate-600 dark:text-slate-300">Ready to connect</div>
                  )}
                </div>

                {/* Call Controls */}
                <div className="flex justify-center space-x-4">
                  {!isConnected && !isConnecting && (
                    <Button onClick={handleConnect} size="lg" className="bg-green-600 hover:bg-green-700">
                      <Phone className="h-5 w-5 mr-2" />
                      Start Call
                    </Button>
                  )}

                  {isConnected && (
                    <>
                      <Button
                        variant={isMuted ? "destructive" : "outline"}
                        size="lg"
                        onClick={() => setIsMuted(!isMuted)}
                        className={!isMuted ? "bg-transparent" : ""}
                      >
                        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      </Button>

                      <Button
                        variant={!isSpeakerOn ? "destructive" : "outline"}
                        size="lg"
                        onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                        className={isSpeakerOn ? "bg-transparent" : ""}
                      >
                        {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                      </Button>

                      <Button variant="destructive" size="lg" onClick={handleDisconnect}>
                        <PhoneOff className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                </div>

                {isConnecting && (
                  <div className="mt-4">
                    <Button variant="outline" onClick={() => setIsConnecting(false)} className="bg-transparent">
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Session Info */}
            {isConnected && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Session Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-2 mb-2">
                          <Clock className="h-4 w-4 text-slate-500" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">Duration</span>
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatTime(callDuration)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-2 mb-2">
                          <DollarSign className="h-4 w-4 text-slate-500" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">Current Cost</span>
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                          {isDemo ? "FREE" : `$${currentCost.toFixed(2)}`}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-2 mb-2">
                          <Star className="h-4 w-4 text-slate-500" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">Quality</span>
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">{connectionQuality}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Expert Info */}
            <Card>
              <CardHeader>
                <CardTitle>About {expertData.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  <span className="font-medium">{expertData.rating}</span>
                  <span className="text-sm text-slate-500">({expertData.sessions} sessions)</span>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-300">{expertData.description}</p>

                <div className="space-y-2">
                  <h4 className="font-medium text-slate-900 dark:text-white">Credentials</h4>
                  <div className="flex flex-wrap gap-1">
                    {expertData.credentials.map((credential, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {credential}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Info */}
            <Card>
              <CardHeader>
                <CardTitle>Session Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    ${expertData.pricePerMinute}/min
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Voice call rate</p>
                </div>

                {isDemo && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">🎉 Free Demo!</h4>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Enjoy a 5-minute free demo session to experience the quality of our AI voice clones.
                    </p>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Minimum session:</span>
                    <span>5 minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Billing:</span>
                    <span>Per minute</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Payment:</span>
                    <span>After session</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alternative Options */}
            <Card>
              <CardHeader>
                <CardTitle>Other Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href={`/chat/${params.id}`} className="block">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Text Chat
                  </Button>
                </Link>
                <Link href={`/video/${params.id}`} className="block">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <Video className="h-4 w-4 mr-2" />
                    Video Call
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle>Voice Call Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
                  <li>• Use headphones for better audio quality</li>
                  <li>• Find a quiet environment</li>
                  <li>• Speak clearly and at normal pace</li>
                  <li>• Take notes during the session</li>
                  <li>• Ask specific questions for better guidance</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
