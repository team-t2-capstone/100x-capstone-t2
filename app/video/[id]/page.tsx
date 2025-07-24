"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Clock,
  DollarSign,
  Star,
  MessageCircle,
  User,
  LogOut,
  Maximize,
  Minimize,
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
  pricePerMinute: 1.67,
  description: "Transform your mindset and achieve lasting personal growth with evidence-based therapeutic approaches.",
  credentials: ["PhD Psychology", "Licensed Therapist", "15+ years experience"],
}

export default function VideoCallPage({ params }: { params: { id: string } }) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [currentCost, setCurrentCost] = useState(0)
  const [connectionQuality, setConnectionQuality] = useState(98)
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
    setIsFullscreen(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Navigation */}
      {!isFullscreen && (
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
      )}

      <div
        className={`${isFullscreen ? "fixed inset-0 z-50 bg-black" : "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}`}
      >
        {/* Header */}
        {!isFullscreen && (
          <div className="mb-8">
            <Link
              href={`/clone/${params.id}`}
              className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
            >
              ← Back to Profile
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">Video Call Session</h1>
            <p className="text-lg text-slate-600 dark:text-slate-300">Connect with {expertData.name} via video</p>
          </div>
        )}

        <div
          className={`grid ${isFullscreen ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-4"} gap-8 ${isFullscreen ? "h-full" : ""}`}
        >
          {/* Main Video Interface */}
          <div className={`${isFullscreen ? "col-span-1 h-full" : "lg:col-span-3"} space-y-6`}>
            {/* Video Call Card */}
            <Card className={`${isFullscreen ? "h-full border-0 rounded-none bg-black" : ""}`}>
              <CardContent className={`${isFullscreen ? "p-0 h-full relative" : "p-0"}`}>
                {/* Demo Banner */}
                {isDemo && !isFullscreen && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-green-400 to-blue-500 text-white text-sm px-4 py-2">
                      🎉 FREE DEMO - {formatDemoTime(demoTimeLeft)} remaining
                    </Badge>
                  </div>
                )}

                {/* Video Area */}
                <div
                  className={`relative ${isFullscreen ? "h-full" : "aspect-video"} bg-gradient-to-br from-slate-900 to-slate-700 rounded-lg overflow-hidden`}
                >
                  {/* Expert Video */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isConnected && isVideoOn ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="w-full h-full bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center"
                      >
                        <div className="text-center text-white">
                          <Avatar className="h-32 w-32 mx-auto mb-4 border-4 border-white/20">
                            <AvatarImage src={expertData.avatar || "/placeholder.svg"} alt={expertData.name} />
                            <AvatarFallback className="text-2xl bg-slate-600">
                              {expertData.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <h3 className="text-xl font-semibold">{expertData.name}</h3>
                          <p className="text-white/80">{expertData.specialty}</p>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="text-center text-white">
                        <Avatar className="h-32 w-32 mx-auto mb-4 border-4 border-white/20">
                          <AvatarImage src={expertData.avatar || "/placeholder.svg"} alt={expertData.name} />
                          <AvatarFallback className="text-2xl bg-slate-600">
                            {expertData.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <h3 className="text-xl font-semibold mb-2">{expertData.name}</h3>
                        {isConnecting && (
                          <div className="space-y-4">
                            <div className="text-lg">Connecting...</div>
                            <Progress value={66} className="w-64 mx-auto" />
                          </div>
                        )}
                        {!isConnected && !isConnecting && (
                          <div className="space-y-4">
                            <p className="text-white/80">Ready to start video call</p>
                            <Button onClick={handleConnect} size="lg" className="bg-green-600 hover:bg-green-700">
                              <Video className="h-5 w-5 mr-2" />
                              Start Video Call
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* User Video (Picture-in-Picture) */}
                  {isConnected && (
                    <div className="absolute bottom-4 right-4 w-32 h-24 bg-slate-800 rounded-lg border-2 border-white/20 overflow-hidden">
                      {isVideoOn ? (
                        <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                          <div className="text-white text-xs">You</div>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                          <VideoOff className="h-6 w-6 text-white/60" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Connection Status */}
                  {isConnected && (
                    <div className="absolute top-4 right-4 flex items-center space-x-2 bg-black/50 rounded-full px-3 py-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-white text-sm">{connectionQuality}%</span>
                    </div>
                  )}

                  {/* Call Duration */}
                  {isConnected && (
                    <div className="absolute top-4 left-4 bg-black/50 rounded-full px-3 py-1">
                      <span className="text-white text-sm font-mono">{formatTime(callDuration)}</span>
                    </div>
                  )}

                  {/* Demo Timer */}
                  {isDemo && isConnected && (
                    <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-green-500 rounded-full px-4 py-1">
                      <span className="text-white text-sm font-medium">Demo: {formatDemoTime(demoTimeLeft)} left</span>
                    </div>
                  )}
                </div>

                {/* Call Controls */}
                {isConnected && (
                  <div className={`${isFullscreen ? "absolute bottom-8 left-1/2 transform -translate-x-1/2" : "p-6"}`}>
                    <div className="flex justify-center space-x-4">
                      <Button
                        variant={isMuted ? "destructive" : "outline"}
                        size="lg"
                        onClick={() => setIsMuted(!isMuted)}
                        className={`${isFullscreen ? "bg-black/50 border-white/20 text-white hover:bg-black/70" : !isMuted ? "bg-transparent" : ""}`}
                      >
                        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      </Button>

                      <Button
                        variant={!isVideoOn ? "destructive" : "outline"}
                        size="lg"
                        onClick={() => setIsVideoOn(!isVideoOn)}
                        className={`${isFullscreen ? "bg-black/50 border-white/20 text-white hover:bg-black/70" : isVideoOn ? "bg-transparent" : ""}`}
                      >
                        {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                      </Button>

                      <Button
                        variant={!isSpeakerOn ? "destructive" : "outline"}
                        size="lg"
                        onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                        className={`${isFullscreen ? "bg-black/50 border-white/20 text-white hover:bg-black/70" : isSpeakerOn ? "bg-transparent" : ""}`}
                      >
                        {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                      </Button>

                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className={`${isFullscreen ? "bg-black/50 border-white/20 text-white hover:bg-black/70" : "bg-transparent"}`}
                      >
                        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                      </Button>

                      <Button variant="destructive" size="lg" onClick={handleDisconnect}>
                        <PhoneOff className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                )}

                {isConnecting && (
                  <div className="p-6 text-center">
                    <Button variant="outline" onClick={() => setIsConnecting(false)} className="bg-transparent">
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Session Info */}
            {isConnected && !isFullscreen && (
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
          {!isFullscreen && (
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
                    <p className="text-sm text-slate-600 dark:text-slate-300">Video call rate</p>
                  </div>

                  {isDemo && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">🎉 Free Demo!</h4>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        Enjoy a 5-minute free demo session to experience the quality of our AI video clones.
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
                  <Link href={`/voice/${params.id}`} className="block">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <Mic className="h-4 w-4 mr-2" />
                      Voice Call
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Tips */}
              <Card>
                <CardHeader>
                  <CardTitle>Video Call Tips</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
                    <li>• Ensure good lighting on your face</li>
                    <li>• Use a stable internet connection</li>
                    <li>• Position camera at eye level</li>
                    <li>• Minimize background distractions</li>
                    <li>• Test your audio and video beforehand</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
