/**
 * React hook for WebRTC call management
 * Provides a clean interface for voice/video calls with AI clones
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { apiClient } from '@/lib/api-client';
import { 
  WebRTCClient, 
  CallConfig, 
  ConnectionState, 
  CallState, 
  CallQualityStats,
  checkWebRTCSupport 
} from '@/lib/webrtc-client';
import { AudioStats } from '@/lib/audio-processor';
import { VideoStats } from '@/lib/video-optimizer';

export interface UseWebRTCOptions {
  onCallEnded?: () => void;
  onError?: (error: Error) => void;
}

export interface CallSession {
  roomId: string;
  cloneId: string;
  callType: 'voice' | 'video';
  duration: number;
  cost: number;
  startTime: Date | null;
}

export function useWebRTC(options: UseWebRTCOptions = {}) {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  
  // Call state
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentSession, setCurrentSession] = useState<CallSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callQuality, setCallQuality] = useState<CallQualityStats | null>(null);
  
  // Enhanced processing state
  const [audioStats, setAudioStats] = useState<AudioStats | null>(null);
  const [videoStats, setVideoStats] = useState<VideoStats | null>(null);
  const [processingEnabled, setProcessingEnabled] = useState({
    audioProcessing: true,
    videoOptimization: true,
    noiseReduction: true,
    adaptiveBitrate: true
  });
  
  // Refs for media elements and WebRTC client
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcClientRef = useRef<WebRTCClient | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check WebRTC support on mount
  useEffect(() => {
    setIsSupported(checkWebRTCSupport());
  }, []);

  /**
   * Start a new call session
   */
  const startCall = useCallback(async (cloneId: string, callType: 'voice' | 'video') => {
    if (!user || !isSupported) {
      const error = new Error(!user ? 'User not authenticated' : 'WebRTC not supported');
      setError(error.message);
      options.onError?.(error);
      return null;
    }

    try {
      setIsInitializing(true);
      setError(null);

      // Create call room via API
      const response = await apiClient.post('/webrtc/create-call', {
        clone_id: cloneId,
        call_type: callType
      });

      const { room_id } = response.data;

      // Initialize call session
      const session: CallSession = {
        roomId: room_id,
        cloneId,
        callType,
        duration: 0,
        cost: 0,
        startTime: null
      };

      setCurrentSession(session);

      // Get user token (you might need to adjust this based on your auth system)
      const token = localStorage.getItem('cloneai_access_token') || '';

      // Configure WebRTC client
      const config: CallConfig = {
        roomId: room_id,
        userId: user.id,
        cloneId,
        callType,
        token
      };

      // Create WebRTC client with event handlers
      const client = new WebRTCClient(config, {
        onConnectionStateChange: setConnectionState,
        onCallStateChange: (state) => {
          setCallState(state);
          
          // Start timer when call connects
          if (state === 'connected' && !session.startTime) {
            session.startTime = new Date();
            setCurrentSession({ ...session });
            startCallTimer();
          }
          
          // Handle call end
          if (state === 'ended') {
            endCall();
          }
        },
        onLocalStream: (stream) => {
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        },
        onRemoteStream: (stream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        },
        onQualityUpdate: setCallQuality,
        onError: (error) => {
          setError(error.message);
          options.onError?.(error);
        },
        onCallEnded: () => {
          options.onCallEnded?.();
        },
        onAudioProcessingUpdate: (stats) => {
          setAudioStats(stats);
        },
        onVideoQualityUpdate: (stats) => {
          setVideoStats(stats);
        }
      });

      webrtcClientRef.current = client;

      // Initialize the call
      await client.initializeCall();

      return session;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start call';
      setError(errorMessage);
      options.onError?.(new Error(errorMessage));
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, [user, isSupported, options]);

  /**
   * End the current call
   */
  const endCall = useCallback(async () => {
    try {
      // End WebRTC call
      if (webrtcClientRef.current) {
        await webrtcClientRef.current.endCall();
        webrtcClientRef.current = null;
      }

      // Stop call timer
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }

      // End call session via API
      if (currentSession) {
        try {
          await apiClient.delete(`/webrtc/room/${currentSession.roomId}`);
        } catch (error) {
          console.error('Failed to end call session:', error);
        }
      }

      // Reset state
      setCurrentSession(null);
      setConnectionState('disconnected');
      setCallState('idle');
      setCallQuality(null);
      setIsMuted(false);
      setIsCameraOff(false);
      setError(null);
      setAudioStats(null);
      setVideoStats(null);

      // Clear video elements
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

    } catch (error) {
      console.error('Failed to end call:', error);
    }
  }, [currentSession]);

  /**
   * Toggle microphone mute
   */
  const toggleMute = useCallback(() => {
    if (webrtcClientRef.current) {
      const muted = webrtcClientRef.current.toggleMute();
      setIsMuted(muted);
      return muted;
    }
    return isMuted;
  }, [isMuted]);

  /**
   * Toggle camera on/off (video calls only)
   */
  const toggleCamera = useCallback(() => {
    if (webrtcClientRef.current && currentSession?.callType === 'video') {
      const cameraOff = webrtcClientRef.current.toggleCamera();
      setIsCameraOff(cameraOff);
      return cameraOff;
    }
    return isCameraOff;
  }, [isCameraOff, currentSession]);

  /**
   * Start call duration timer
   */
  const startCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }

    callTimerRef.current = setInterval(() => {
      setCurrentSession(prev => {
        if (!prev || !prev.startTime) return prev;
        
        const duration = Math.floor((Date.now() - prev.startTime.getTime()) / 1000);
        const cost = duration * 0.02; // $0.02 per minute for demo
        
        return {
          ...prev,
          duration,
          cost: parseFloat(cost.toFixed(2))
        };
      });
    }, 1000);
  }, []);

  /**
   * Format call duration for display
   */
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Get connection quality display with enhanced metrics
   */
  const getQualityDisplay = useCallback((): string => {
    if (!callQuality) return 'Unknown';
    
    const quality = callQuality.connectionQuality;
    if (quality >= 90) return 'Excellent';
    if (quality >= 70) return 'Good';
    if (quality >= 50) return 'Fair';
    return 'Poor';
  }, [callQuality]);

  /**
   * Get detailed quality metrics
   */
  const getDetailedQualityInfo = useCallback(() => {
    return {
      connection: callQuality,
      audio: audioStats,
      video: videoStats,
      overall: {
        score: callQuality?.connectionQuality || 0,
        audioQuality: audioStats?.qualityScore || 0,
        videoQuality: videoStats?.qualityScore || 0,
        noiseLevel: audioStats?.noiseLevel || 0,
        adaptationCount: videoStats?.adaptationCount || 0
      }
    };
  }, [callQuality, audioStats, videoStats]);

  /**
   * Manually adjust video quality
   */
  const setVideoQuality = useCallback(async (quality: 'excellent' | 'good' | 'fair' | 'poor') => {
    if (webrtcClientRef.current) {
      try {
        await webrtcClientRef.current.setVideoQuality(quality);
      } catch (error) {
        console.error('Failed to set video quality:', error);
      }
    }
  }, []);

  /**
   * Toggle audio processing features
   */
  const toggleAudioProcessing = useCallback((feature: keyof typeof processingEnabled, enabled?: boolean) => {
    setProcessingEnabled(prev => {
      const newEnabled = enabled !== undefined ? enabled : !prev[feature];
      const newState = { ...prev, [feature]: newEnabled };
      
      // Apply changes to WebRTC client
      if (webrtcClientRef.current?.audioProcessing) {
        const config = {
          enableNoiseSuppression: newState.noiseReduction,
          enableAdvancedProcessing: newState.audioProcessing
        };
        webrtcClientRef.current.updateAudioConfig(config);
      }
      
      if (webrtcClientRef.current?.videoOptimization) {
        const config = {
          enableAdaptiveBitrate: newState.adaptiveBitrate,
          enableResolutionScaling: newState.videoOptimization
        };
        webrtcClientRef.current.updateVideoConfig(config);
      }
      
      return newState;
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    // Support and capabilities
    isSupported,
    
    // Call state
    connectionState,
    callState,
    currentSession,
    error,
    isInitializing,
    
    // Media state
    isMuted,
    isCameraOff,
    callQuality,
    
    // Enhanced processing state
    audioStats,
    videoStats,
    processingEnabled,
    
    // Actions
    startCall,
    endCall,
    toggleMute,
    toggleCamera,
    setVideoQuality,
    toggleAudioProcessing,
    
    // Utilities
    formatDuration,
    getQualityDisplay,
    getDetailedQualityInfo,
    
    // Refs for video elements
    localVideoRef,
    remoteVideoRef,
    
    // Computed properties
    isConnecting: callState === 'connecting' || isInitializing,
    isConnected: callState === 'connected',
    isEnded: callState === 'ended',
    callDuration: currentSession?.duration || 0,
    callCost: currentSession?.cost || 0,
    connectionQuality: callQuality?.connectionQuality || 0,
    
    // Enhanced metrics
    audioQuality: audioStats?.qualityScore || 0,
    videoQuality: videoStats?.qualityScore || 0,
    noiseLevel: audioStats?.noiseLevel || 0,
    videoAdaptations: videoStats?.adaptationCount || 0
  };
}