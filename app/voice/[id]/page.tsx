"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { useWebRTC } from "@/hooks/use-webrtc"
import { useAuth } from "@/contexts/auth-context"
import { CallQualityMonitor, CallQualityIndicator } from "@/components/ui/call-quality-monitor"
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
  const { user } = useAuth()
  const [isDemo, setIsDemo] = useState(true)
  const [demoTimeLeft, setDemoTimeLeft] = useState(300) // 5 minutes demo
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [showQualityMonitor, setShowQualityMonitor] = useState(false)
  
  // WebRTC hook for call management
  const {
    isSupported,
    connectionState,
    callState,
    currentSession,
    error,
    isInitializing,
    isMuted,
    callQuality,
    audioStats,
    videoStats,
    processingEnabled,
    startCall,
    endCall,
    toggleMute,
    setVideoQuality,
    toggleAudioProcessing,
    formatDuration,
    getQualityDisplay,
    getDetailedQualityInfo,
    isConnecting,
    isConnected,
    callDuration,
    callCost,
    connectionQuality,
    audioQuality,
    noiseLevel
  } = useWebRTC({
    onCallEnded: () => {
      setDemoTimeLeft(300)
    },
    onError: (error) => {
      console.error('Voice call error:', error)
    }
  })

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isConnected && isDemo) {
      interval = setInterval(() => {
        if (demoTimeLeft > 0) {
          setDemoTimeLeft((prev) => prev - 1)
        } else {
          // Demo time expired, end call
          endCall()
        }
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isConnected, isDemo, demoTimeLeft, endCall])


  const formatDemoTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleConnect = async () => {
    if (!user) {
      console.error('User not authenticated')
      return
    }
    
    try {
      await startCall(params.id, 'voice')
    } catch (error) {
      console.error('Failed to start voice call:', error)
    }
  }

  const handleDisconnect = async () => {
    try {
      await endCall()
    } catch (error) {
      console.error('Failed to end voice call:', error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

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
                  {(isConnecting || isInitializing) && (
                    <div className="space-y-4">
                      <div className="text-lg font-medium text-blue-600 dark:text-blue-400">
                        {isInitializing ? 'Initializing...' : 'Connecting...'}
                      </div>
                      <Progress value={isInitializing ? 33 : 66} className="w-full max-w-xs mx-auto" />
                      {connectionState && (
                        <div className="text-sm text-slate-500">Status: {connectionState}</div>
                      )}
                    </div>
                  )}
                  {isConnected && (
                    <div className="space-y-2">
                      <div className="text-lg font-medium text-green-600">Connected</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatDuration(callDuration)}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        Connection Quality: {connectionQuality}% ({getQualityDisplay()})
                      </div>
                      {error && (
                        <div className="text-sm text-red-500">Error: {error}</div>
                      )}
                    </div>
                  )}
                  {!isConnected && !isConnecting && !isInitializing && (
                    <div className="space-y-2">
                      <div className="text-lg font-medium text-slate-600 dark:text-slate-300">
                        {isSupported ? 'Ready to connect' : 'WebRTC not supported'}
                      </div>
                      {!isSupported && (
                        <div className="text-sm text-orange-500">
                          Your browser doesn't support WebRTC calls
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Call Controls */}
                <div className="flex justify-center space-x-4">
                  {!isConnected && !isConnecting && !isInitializing && (
                    <Button 
                      onClick={handleConnect} 
                      size="lg" 
                      className="bg-green-600 hover:bg-green-700"
                      disabled={!isSupported || !user}
                    >
                      <Phone className="h-5 w-5 mr-2" />
                      Start Call
                    </Button>
                  )}

                  {isConnected && (
                    <>
                      <Button
                        variant={isMuted ? "destructive" : "outline"}
                        size="lg"
                        onClick={toggleMute}
                        className={!isMuted ? "bg-transparent" : ""}
                        title={isMuted ? "Unmute microphone" : "Mute microphone"}
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

                {(isConnecting || isInitializing) && (
                  <div className="mt-4">
                    <Button variant="outline" onClick={handleDisconnect} className="bg-transparent">
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Call Quality Monitor */}
            {isConnected && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <CallQualityMonitor
                  callQuality={callQuality}
                  audioStats={audioStats}
                  videoStats={videoStats}
                  processingEnabled={processingEnabled}
                  onToggleProcessing={toggleAudioProcessing}
                  onSetVideoQuality={setVideoQuality}
                  isExpanded={showQualityMonitor}
                  onToggleExpanded={() => setShowQualityMonitor(!showQualityMonitor)}
                />
              </motion.div>
            )}

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
                          {formatDuration(callDuration)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-2 mb-2">
                          <DollarSign className="h-4 w-4 text-slate-500" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">Current Cost</span>
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                          {isDemo ? "FREE" : `$${callCost.toFixed(2)}`}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-2 mb-2">
                          <Star className="h-4 w-4 text-slate-500" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">Quality</span>
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                          {connectionQuality}% ({getQualityDisplay()})
                        </div>
                        {audioQuality > 0 && (
                          <div className="text-sm text-slate-500">
                            Audio: {audioQuality}% | Noise: {noiseLevel.toFixed(1)}dB
                          </div>
                        )}
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
