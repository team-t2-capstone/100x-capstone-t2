"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { useWebRTC } from "@/hooks/use-webrtc"
import { useAuth } from "@/contexts/auth-context"
import { CallQualityMonitor, CallQualityIndicator } from "@/components/ui/call-quality-monitor"
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
  const { user } = useAuth()
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isDemo, setIsDemo] = useState(true)
  const [demoTimeLeft, setDemoTimeLeft] = useState(300) // 5 minutes demo
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
    isCameraOff,
    callQuality,
    audioStats,
    videoStats,
    processingEnabled,
    startCall,
    endCall,
    toggleMute,
    toggleCamera,
    setVideoQuality,
    toggleAudioProcessing,
    formatDuration,
    getQualityDisplay,
    getDetailedQualityInfo,
    localVideoRef,
    remoteVideoRef,
    isConnecting,
    isConnected,
    callDuration,
    callCost,
    connectionQuality,
    audioQuality,
    videoQuality
  } = useWebRTC({
    onCallEnded: () => {
      setDemoTimeLeft(300)
      setIsFullscreen(false)
    },
    onError: (error) => {
      console.error('Video call error:', error)
    }
  })
  
  // Update local video on state when camera toggles
  useEffect(() => {
    setIsVideoOn(!isCameraOff)
  }, [isCameraOff])

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
      await startCall(params.id, 'video')
    } catch (error) {
      console.error('Failed to start video call:', error)
    }
  }

  const handleDisconnect = async () => {
    try {
      await endCall()
      setIsFullscreen(false)
    } catch (error) {
      console.error('Failed to end video call:', error)
    }
  }
  
  const handleToggleCamera = () => {
    const newState = toggleCamera()
    setIsVideoOn(!newState)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

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
                  {/* Remote Video Stream */}
                  <div className="absolute inset-0">
                    <video 
                      ref={remoteVideoRef}
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                      style={{ display: isConnected ? 'block' : 'none' }}
                    />
                  </div>
                  
                  {/* Expert Placeholder */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {!isConnected || !remoteVideoRef.current?.srcObject ? (
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
                        {(isConnecting || isInitializing) && (
                          <div className="space-y-4">
                            <div className="text-lg">
                              {isInitializing ? 'Initializing...' : 'Connecting...'}
                            </div>
                            <Progress value={isInitializing ? 33 : 66} className="w-64 mx-auto" />
                            {connectionState && (
                              <div className="text-sm text-white/70">Status: {connectionState}</div>
                            )}
                          </div>
                        )}
                        {!isConnected && !isConnecting && !isInitializing && (
                          <div className="space-y-4">
                            <p className="text-white/80">
                              {isSupported ? 'Ready to start video call' : 'WebRTC not supported'}
                            </p>
                            {!isSupported && (
                              <div className="text-sm text-orange-300">
                                Your browser doesn't support WebRTC calls
                              </div>
                            )}
                            <Button 
                              onClick={handleConnect} 
                              size="lg" 
                              className="bg-green-600 hover:bg-green-700"
                              disabled={!isSupported || !user}
                            >
                              <Video className="h-5 w-5 mr-2" />
                              Start Video Call
                            </Button>
                          </div>
                        )}
                        {error && (
                          <div className="text-sm text-red-300 mt-2">Error: {error}</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Local Video (Picture-in-Picture) */}
                  {isConnected && (
                    <div className="absolute bottom-4 right-4 w-32 h-24 bg-slate-800 rounded-lg border-2 border-white/20 overflow-hidden">
                      {isVideoOn ? (
                        <video 
                          ref={localVideoRef}
                          autoPlay 
                          playsInline 
                          muted 
                          className="w-full h-full object-cover" 
                          style={{ transform: 'scaleX(-1)' }}
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                          <VideoOff className="h-6 w-6 text-white/60" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Enhanced Connection Status */}
                  {isConnected && (
                    <div className="absolute top-4 right-4">
                      <CallQualityIndicator
                        overallQuality={Math.round((connectionQuality + audioQuality + videoQuality) / 3)}
                        audioLevel={audioStats?.inputLevel || 0}
                        connectionState={connectionState}
                      />
                    </div>
                  )}

                  {/* Call Duration */}
                  {isConnected && (
                    <div className="absolute top-4 left-4 bg-black/50 rounded-full px-3 py-1">
                      <span className="text-white text-sm font-mono">{formatDuration(callDuration)}</span>
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
                        onClick={toggleMute}
                        className={`${isFullscreen ? "bg-black/50 border-white/20 text-white hover:bg-black/70" : !isMuted ? "bg-transparent" : ""}`}
                        title={isMuted ? "Unmute microphone" : "Mute microphone"}
                      >
                        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      </Button>

                      <Button
                        variant={!isVideoOn ? "destructive" : "outline"}
                        size="lg"
                        onClick={handleToggleCamera}
                        className={`${isFullscreen ? "bg-black/50 border-white/20 text-white hover:bg-black/70" : isVideoOn ? "bg-transparent" : ""}`}
                        title={isVideoOn ? "Turn off camera" : "Turn on camera"}
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

                {(isConnecting || isInitializing) && (
                  <div className="p-6 text-center">
                    <Button variant="outline" onClick={handleDisconnect} className="bg-transparent">
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Call Quality Monitor */}
            {isConnected && !isFullscreen && (
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
                        <div className="text-sm text-slate-500">
                          Audio: {audioQuality}% | Video: {videoQuality}%
                        </div>
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
