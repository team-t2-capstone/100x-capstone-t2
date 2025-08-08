/**
 * WebRTC Client for CloneAI Voice/Video Calls
 * Handles peer connection management, signaling, and media streaming
 * Now with advanced audio processing and video optimization
 */

import { AudioProcessor, DEFAULT_AUDIO_CONFIG, AudioStats } from './audio-processor';
import { VideoQualityOptimizer, DEFAULT_VIDEO_CONFIG, VideoStats } from './video-optimizer';

export interface CallConfig {
  roomId: string;
  userId: string;
  cloneId: string;
  callType: 'voice' | 'video';
  token: string; // JWT token for authentication
}

export interface MediaConstraints {
  audio: boolean;
  video: boolean;
}

export interface CallQualityStats {
  connectionQuality: number; // 0-100
  audioLevel: number; // 0-100
  bandwidth: number; // kbps
  latency: number; // ms
  packetsLost: number;
  totalPackets: number;
  // Enhanced stats from processors
  audioStats?: AudioStats;
  videoStats?: VideoStats;
}

export type ConnectionState = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'reconnecting' 
  | 'failed';

export type CallState = 
  | 'idle' 
  | 'connecting' 
  | 'connected' 
  | 'ended' 
  | 'failed';

export interface CallEvents {
  onConnectionStateChange: (state: ConnectionState) => void;
  onCallStateChange: (state: CallState) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onLocalStream: (stream: MediaStream) => void;
  onQualityUpdate: (stats: CallQualityStats) => void;
  onError: (error: Error) => void;
  onCallEnded: (reason?: string) => void;
  onAudioProcessingUpdate?: (stats: AudioStats) => void;
  onVideoQualityUpdate?: (stats: VideoStats) => void;
}

export class WebRTCClient {
  private config: CallConfig;
  private events: CallEvents;
  private peerConnection: RTCPeerConnection | null = null;
  private websocket: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  
  private connectionState: ConnectionState = 'disconnected';
  private callState: CallState = 'idle';
  
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private qualityCheckInterval: NodeJS.Timeout | null = null;
  
  // Audio and video processing
  private audioProcessor: AudioProcessor | null = null;
  private videoOptimizer: VideoQualityOptimizer | null = null;
  private processedStream: MediaStream | null = null;
  
  // STUN/TURN servers configuration
  private iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // TODO: Add TURN servers for production
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'your-username',
    //   credential: 'your-password'
    // }
  ];

  constructor(config: CallConfig, events: CallEvents) {
    this.config = config;
    this.events = events;
  }

  /**
   * Initialize the call - get user media and establish signaling connection
   */
  async initializeCall(): Promise<void> {
    try {
      this.setCallState('connecting');
      
      // Get user media based on call type
      const constraints: MediaConstraints = {
        audio: true,
        video: this.config.callType === 'video'
      };
      
      await this.getUserMedia(constraints);
      await this.connectSignaling();
      
    } catch (error) {
      this.handleError(new Error(`Failed to initialize call: ${error}`));
      throw error;
    }
  }

  /**
   * Get user media with optimized constraints and processing
   */
  private async getUserMedia(constraints: MediaConstraints): Promise<void> {
    try {
      // Get optimized constraints
      const mediaConstraints: MediaStreamConstraints = {
        audio: constraints.audio ? AudioProcessor.getOptimalAudioConstraints() : false,
        video: constraints.video ? VideoQualityOptimizer.getOptimalVideoConstraints(DEFAULT_VIDEO_CONFIG) : false
      };

      const rawStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      
      // Initialize audio processing if audio is enabled
      if (constraints.audio && AudioProcessor.isSupported()) {
        this.audioProcessor = new AudioProcessor(DEFAULT_AUDIO_CONFIG);
        await this.audioProcessor.initialize();
        
        // Set up audio stats callback
        this.audioProcessor.onStats((stats) => {
          this.events.onAudioProcessingUpdate?.(stats);
        });
        
        // Process audio stream
        const processedAudioStream = await this.audioProcessor.processStream(rawStream);
        
        // Create combined stream
        const audioTracks = processedAudioStream.getAudioTracks();
        const videoTracks = rawStream.getVideoTracks();
        
        this.processedStream = new MediaStream([...audioTracks, ...videoTracks]);
        this.localStream = this.processedStream;
      } else {
        this.localStream = rawStream;
      }
      
      // Initialize video optimization if video is enabled
      if (constraints.video && VideoQualityOptimizer.isSupported()) {
        this.videoOptimizer = new VideoQualityOptimizer(DEFAULT_VIDEO_CONFIG);
        
        // Video optimizer will be initialized after peer connection is created
      }

      this.events.onLocalStream(this.localStream);
      console.log('Media acquired with processing enabled');
      
    } catch (error) {
      throw new Error(`Failed to get user media: ${error}`);
    }
  }

  /**
   * Connect to the signaling server via WebSocket
   */
  private async connectSignaling(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001'}/api/v1/webrtc/signal/${this.config.roomId}`;
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = async () => {
          console.log('WebSocket connected');
          
          // Send authentication
          if (this.websocket) {
            this.websocket.send(JSON.stringify({
              type: 'auth',
              user_id: this.config.userId,
              token: this.config.token
            }));
          }
        };

        this.websocket.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            await this.handleSignalingMessage(message);
            
            if (message.type === 'connected') {
              this.setConnectionState('connected');
              resolve();
            }
            
          } catch (error) {
            console.error('Failed to parse signaling message:', error);
          }
        };

        this.websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.setConnectionState('failed');
          reject(new Error('WebSocket connection failed'));
        };

        this.websocket.onclose = () => {
          console.log('WebSocket closed');
          this.setConnectionState('disconnected');
          this.attemptReconnection();
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create and configure RTCPeerConnection
   */
  private createPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.localStream) {
          pc.addTrack(track, this.localStream);
        }
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track');
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.events.onRemoteStream(this.remoteStream);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }));
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Peer connection state:', pc.connectionState);
      
      switch (pc.connectionState) {
        case 'connected':
          this.setCallState('connected');
          this.startQualityMonitoring();
          this.initializeVideoOptimization();
          break;
        case 'disconnected':
        case 'failed':
          this.setCallState('failed');
          this.stopQualityMonitoring();
          break;
        case 'connecting':
          this.setCallState('connecting');
          break;
      }
    };

    return pc;
  }

  /**
   * Handle incoming signaling messages
   */
  private async handleSignalingMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'connected':
          console.log('Signaling connected, creating peer connection');
          this.peerConnection = this.createPeerConnection();
          await this.createOffer();
          break;

        case 'offer':
          if (this.peerConnection) {
            await this.peerConnection.setRemoteDescription(message.offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            if (this.websocket?.readyState === WebSocket.OPEN) {
              this.websocket.send(JSON.stringify({
                type: 'answer',
                answer: answer
              }));
            }
          }
          break;

        case 'answer':
          if (this.peerConnection) {
            await this.peerConnection.setRemoteDescription(message.answer);
          }
          break;

        case 'ice-candidate':
          if (this.peerConnection && message.candidate) {
            await this.peerConnection.addIceCandidate(message.candidate);
          }
          break;

        case 'user_left':
          this.handleCallEnded('Remote user left');
          break;

        case 'error':
          this.handleError(new Error(message.message || 'Signaling error'));
          break;

        default:
          console.log('Unknown signaling message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
      this.handleError(new Error(`Signaling error: ${error}`));
    }
  }

  /**
   * Create and send offer to establish connection
   */
  private async createOffer(): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'offer',
          offer: offer
        }));
      }
    } catch (error) {
      this.handleError(new Error(`Failed to create offer: ${error}`));
    }
  }

  /**
   * Mute/unmute microphone
   */
  toggleMute(): boolean {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // Return true if muted
    }
    return false;
  }

  /**
   * Enable/disable camera (for video calls)
   */
  toggleCamera(): boolean {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled; // Return true if camera off
    }
    return false;
  }

  /**
   * Initialize video optimization after connection is established
   */
  private async initializeVideoOptimization(): Promise<void> {
    if (this.videoOptimizer && this.peerConnection) {
      try {
        await this.videoOptimizer.initialize(this.peerConnection);
        
        // Set up video stats callback
        this.videoOptimizer.onStats((stats) => {
          this.events.onVideoQualityUpdate?.(stats);
        });
        
        console.log('Video optimization initialized');
      } catch (error) {
        console.error('Failed to initialize video optimization:', error);
      }
    }
  }

  /**
   * Start monitoring call quality with enhanced processing
   */
  private startQualityMonitoring(): void {
    this.qualityCheckInterval = setInterval(async () => {
      await this.checkCallQuality();
      
      // Auto-adjust audio gain if enabled
      if (this.audioProcessor) {
        this.audioProcessor.adjustGain(60); // Target 60% level
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Stop monitoring call quality
   */
  private stopQualityMonitoring(): void {
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
      this.qualityCheckInterval = null;
    }
  }

  /**
   * Check call quality metrics with enhanced processing data
   */
  private async checkCallQuality(): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const stats = await this.peerConnection.getStats();
      let packetsLost = 0;
      let totalPackets = 0;
      let bandwidth = 0;
      let latency = 0;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp') {
          packetsLost += report.packetsLost || 0;
          totalPackets += report.packetsReceived || 0;
          bandwidth = Math.round((report.bytesReceived || 0) * 8 / 1024); // Convert to kbps
        }
        
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          latency = report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : 0;
        }
      });

      const lossRate = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;
      const connectionQuality = Math.max(0, Math.min(100, 100 - (lossRate * 10) - (latency > 200 ? 20 : 0)));

      // Get enhanced stats from processors
      const audioStats = this.audioProcessor?.getStats();
      const videoStats = this.videoOptimizer?.getStats();
      
      const qualityStats: CallQualityStats = {
        connectionQuality: Math.round(connectionQuality),
        audioLevel: audioStats?.inputLevel || 0,
        bandwidth,
        latency,
        packetsLost,
        totalPackets,
        audioStats,
        videoStats
      };

      this.events.onQualityUpdate(qualityStats);
      
    } catch (error) {
      console.error('Failed to get call quality stats:', error);
    }
  }

  /**
   * Attempt to reconnect to the signaling server
   */
  private async attemptReconnection(): Promise<void> {
    if (this.callState === 'ended' || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    this.setConnectionState('reconnecting');

    setTimeout(async () => {
      try {
        await this.connectSignaling();
        this.reconnectAttempts = 0;
      } catch (error) {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnection();
        } else {
          this.setConnectionState('failed');
          this.handleError(new Error('Failed to reconnect after maximum attempts'));
        }
      }
    }, 1000 * this.reconnectAttempts); // Exponential backoff
  }

  /**
   * End the call and clean up resources including processors
   */
  async endCall(): Promise<void> {
    console.log('Ending call...');
    
    this.setCallState('ended');
    this.stopQualityMonitoring();

    // Dispose audio processor
    if (this.audioProcessor) {
      this.audioProcessor.dispose();
      this.audioProcessor = null;
    }

    // Dispose video optimizer
    if (this.videoOptimizer) {
      this.videoOptimizer.dispose();
      this.videoOptimizer = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Close WebSocket
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    // Stop local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }

    // Stop processed stream
    if (this.processedStream) {
      this.processedStream.getTracks().forEach(track => {
        track.stop();
      });
      this.processedStream = null;
    }

    this.events.onCallEnded();
  }

  /**
   * Handle call ended by remote party
   */
  private handleCallEnded(reason?: string): void {
    console.log('Call ended:', reason);
    this.endCall();
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error('WebRTC error:', error);
    this.events.onError(error);
  }

  /**
   * Set connection state and notify
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.events.onConnectionStateChange(state);
    }
  }

  /**
   * Set call state and notify
   */
  private setCallState(state: CallState): void {
    if (this.callState !== state) {
      this.callState = state;
      this.events.onCallStateChange(state);
    }
  }

  // Getters
  get currentConnectionState(): ConnectionState {
    return this.connectionState;
  }

  get currentCallState(): CallState {
    return this.callState;
  }

  get isConnected(): boolean {
    return this.callState === 'connected';
  }

  /**
   * Get audio processing instance for manual control
   */
  get audioProcessing(): AudioProcessor | null {
    return this.audioProcessor;
  }

  /**
   * Get video optimization instance for manual control
   */
  get videoOptimization(): VideoQualityOptimizer | null {
    return this.videoOptimizer;
  }

  /**
   * Manually adjust video quality preset
   */
  async setVideoQuality(quality: 'excellent' | 'good' | 'fair' | 'poor'): Promise<void> {
    if (this.videoOptimizer) {
      await this.videoOptimizer.setQualityPreset(quality);
    }
  }

  /**
   * Update audio processing configuration
   */
  updateAudioConfig(config: any): void {
    if (this.audioProcessor) {
      this.audioProcessor.updateConfig(config);
    }
  }

  /**
   * Update video optimization configuration
   */
  updateVideoConfig(config: any): void {
    if (this.videoOptimizer) {
      this.videoOptimizer.updateConfig(config);
    }
  }
}

// Utility functions
export const checkWebRTCSupport = (): boolean => {
  return !!(
    typeof window !== 'undefined' &&
    window.RTCPeerConnection &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
};

export const getMediaDevices = async (): Promise<MediaDeviceInfo[]> => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => 
      device.kind === 'audioinput' || 
      device.kind === 'videoinput' || 
      device.kind === 'audiooutput'
    );
  } catch (error) {
    console.error('Failed to enumerate media devices:', error);
    return [];
  }
};