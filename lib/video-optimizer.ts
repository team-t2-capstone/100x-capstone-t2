/**
 * Advanced Video Quality Optimization for WebRTC Calls
 * Implements adaptive bitrate, resolution scaling, and quality monitoring
 */

export interface VideoQualityConfig {
  enableAdaptiveBitrate: boolean;
  enableResolutionScaling: boolean;
  targetFrameRate: number;
  maxBitrate: number;
  minBitrate: number;
  preferredCodec: 'vp8' | 'vp9' | 'h264';
  adaptationMode: 'automatic' | 'manual';
}

export interface VideoStats {
  currentBitrate: number;
  currentFrameRate: number;
  currentResolution: { width: number; height: number };
  packetsLost: number;
  jitter: number;
  qualityScore: number;
  adaptationCount: number;
}

export interface NetworkCondition {
  bandwidth: number; // kbps
  latency: number; // ms
  packetLoss: number; // percentage
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export class VideoQualityOptimizer {
  private peerConnection: RTCPeerConnection | null = null;
  private sender: RTCRtpSender | null = null;
  private config: VideoQualityConfig;
  private stats: VideoStats = {
    currentBitrate: 0,
    currentFrameRate: 0,
    currentResolution: { width: 0, height: 0 },
    packetsLost: 0,
    jitter: 0,
    qualityScore: 100,
    adaptationCount: 0
  };

  private isOptimizing = false;
  private adaptationHistory: number[] = [];
  private lastStatsTime = 0;
  private optimizationInterval: NodeJS.Timeout | null = null;
  private onStatsUpdate?: (stats: VideoStats) => void;

  // Quality presets for different network conditions
  private readonly qualityPresets = {
    excellent: { width: 1280, height: 720, frameRate: 30, bitrate: 2500 },
    good: { width: 960, height: 540, frameRate: 30, bitrate: 1500 },
    fair: { width: 640, height: 360, frameRate: 24, bitrate: 800 },
    poor: { width: 480, height: 270, frameRate: 15, bitrate: 400 }
  };

  constructor(config: VideoQualityConfig) {
    this.config = config;
  }

  /**
   * Initialize video optimization for a peer connection
   */
  async initialize(peerConnection: RTCPeerConnection): Promise<void> {
    this.peerConnection = peerConnection;

    // Find video sender
    const senders = peerConnection.getSenders();
    this.sender = senders.find(sender => 
      sender.track && sender.track.kind === 'video'
    ) || null;

    if (!this.sender) {
      console.warn('No video sender found for optimization');
      return;
    }

    // Configure initial encoding parameters
    await this.applyInitialOptimizations();

    // Start quality monitoring
    this.startQualityMonitoring();
    console.log('Video quality optimizer initialized');
  }

  /**
   * Apply initial video optimizations
   */
  private async applyInitialOptimizations(): Promise<void> {
    if (!this.sender) return;

    try {
      const params = this.sender.getParameters();
      
      if (params.encodings && params.encodings.length > 0) {
        const encoding = params.encodings[0];
        
        // Set initial bitrate constraints
        encoding.maxBitrate = this.config.maxBitrate * 1000; // Convert to bps
        encoding.minBitrate = this.config.minBitrate * 1000;
        
        // Set frame rate
        encoding.maxFramerate = this.config.targetFrameRate;
        
        // Enable hardware acceleration if available
        if ('hardwareAcceleration' in encoding) {
          (encoding as any).hardwareAcceleration = 'prefer-hardware';
        }

        // Apply degradation preferences
        encoding.degradationPreference = 'maintain-framerate';
        
        await this.sender.setParameters(params);
        console.log('Initial video optimizations applied:', encoding);
      }
    } catch (error) {
      console.error('Failed to apply initial video optimizations:', error);
    }
  }

  /**
   * Start continuous quality monitoring and optimization
   */
  private startQualityMonitoring(): void {
    if (this.isOptimizing) return;

    this.isOptimizing = true;
    this.optimizationInterval = setInterval(async () => {
      await this.updateVideoStats();
      
      if (this.config.enableAdaptiveBitrate || this.config.enableResolutionScaling) {
        await this.optimizeQuality();
      }
    }, 2000); // Check every 2 seconds

    console.log('Video quality monitoring started');
  }

  /**
   * Update video statistics from WebRTC stats
   */
  private async updateVideoStats(): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const stats = await this.peerConnection.getStats();
      let videoStats: any = null;
      let candidatePairStats: any = null;

      stats.forEach((report) => {
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          videoStats = report;
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          candidatePairStats = report;
        }
      });

      if (videoStats) {
        // Calculate current bitrate
        const now = Date.now();
        if (this.lastStatsTime > 0 && videoStats.bytesSent) {
          const timeDelta = (now - this.lastStatsTime) / 1000;
          const bytesDelta = videoStats.bytesSent - (this.stats.currentBitrate || 0);
          this.stats.currentBitrate = Math.round((bytesDelta * 8) / timeDelta / 1000); // kbps
        }
        this.lastStatsTime = now;

        // Update other stats
        this.stats.currentFrameRate = videoStats.framesPerSecond || 0;
        this.stats.packetsLost = videoStats.packetsLost || 0;
        
        if (videoStats.frameWidth && videoStats.frameHeight) {
          this.stats.currentResolution = {
            width: videoStats.frameWidth,
            height: videoStats.frameHeight
          };
        }

        // Calculate quality score based on multiple factors
        this.calculateQualityScore(videoStats, candidatePairStats);
      }

      // Notify listeners
      if (this.onStatsUpdate) {
        this.onStatsUpdate({ ...this.stats });
      }

    } catch (error) {
      console.error('Failed to update video stats:', error);
    }
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(videoStats: any, networkStats: any): void {
    let score = 100;

    // Penalize for packet loss
    if (this.stats.packetsLost > 0) {
      const lossRate = this.stats.packetsLost / (videoStats.packetsSent || 1);
      score -= lossRate * 50;
    }

    // Penalize for low frame rate
    const targetFrameRate = this.config.targetFrameRate;
    const frameRateRatio = Math.min(this.stats.currentFrameRate / targetFrameRate, 1);
    score *= frameRateRatio;

    // Penalize for low bitrate
    const targetBitrate = (this.config.maxBitrate + this.config.minBitrate) / 2;
    const bitrateRatio = Math.min(this.stats.currentBitrate / targetBitrate, 1);
    score *= bitrateRatio;

    // Consider network jitter
    if (networkStats && networkStats.currentRoundTripTime) {
      this.stats.jitter = networkStats.currentRoundTripTime * 1000; // Convert to ms
      if (this.stats.jitter > 100) {
        score *= Math.max(0.5, 1 - (this.stats.jitter - 100) / 500);
      }
    }

    this.stats.qualityScore = Math.max(0, Math.round(score));
  }

  /**
   * Detect current network conditions
   */
  private async detectNetworkConditions(): Promise<NetworkCondition> {
    if (!this.peerConnection) {
      return { bandwidth: 1000, latency: 100, packetLoss: 0, quality: 'good' };
    }

    try {
      const stats = await this.peerConnection.getStats();
      let bandwidth = 1000; // Default 1Mbps
      let latency = 100; // Default 100ms
      let packetLoss = 0;

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          latency = (report.currentRoundTripTime || 0.1) * 1000;
          bandwidth = Math.max(bandwidth, (report.availableOutgoingBitrate || 1000000) / 1000);
        }
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          const totalPackets = report.packetsSent || 1;
          packetLoss = ((report.packetsLost || 0) / totalPackets) * 100;
        }
      });

      // Determine quality based on metrics
      let quality: NetworkCondition['quality'] = 'excellent';
      if (bandwidth < 500 || latency > 200 || packetLoss > 3) {
        quality = 'poor';
      } else if (bandwidth < 1000 || latency > 100 || packetLoss > 1) {
        quality = 'fair';
      } else if (bandwidth < 2000 || latency > 50 || packetLoss > 0.5) {
        quality = 'good';
      }

      return { bandwidth, latency, packetLoss, quality };

    } catch (error) {
      console.error('Failed to detect network conditions:', error);
      return { bandwidth: 1000, latency: 100, packetLoss: 0, quality: 'good' };
    }
  }

  /**
   * Optimize video quality based on current conditions
   */
  private async optimizeQuality(): Promise<void> {
    if (!this.sender || this.config.adaptationMode === 'manual') return;

    try {
      const networkCondition = await this.detectNetworkConditions();
      const targetPreset = this.qualityPresets[networkCondition.quality];

      // Check if adaptation is needed
      const shouldAdapt = this.shouldAdaptQuality(networkCondition, targetPreset);
      
      if (shouldAdapt) {
        await this.adaptVideoParameters(targetPreset);
        this.stats.adaptationCount++;
        this.adaptationHistory.push(Date.now());
        
        console.log(`Video quality adapted to ${networkCondition.quality}:`, targetPreset);
      }

    } catch (error) {
      console.error('Failed to optimize video quality:', error);
    }
  }

  /**
   * Determine if quality adaptation is needed
   */
  private shouldAdaptQuality(network: NetworkCondition, target: any): boolean {
    // Don't adapt too frequently
    const recentAdaptations = this.adaptationHistory.filter(
      time => Date.now() - time < 10000 // Last 10 seconds
    );
    if (recentAdaptations.length > 3) return false;

    // Check if current settings are significantly different from target
    const currentResolution = this.stats.currentResolution;
    const resolutionDiff = Math.abs(currentResolution.width - target.width) > 100;
    const frameRateDiff = Math.abs(this.stats.currentFrameRate - target.frameRate) > 5;
    const bitrateDiff = Math.abs(this.stats.currentBitrate - target.bitrate) > 200;

    return resolutionDiff || frameRateDiff || bitrateDiff;
  }

  /**
   * Apply video parameter adaptations
   */
  private async adaptVideoParameters(preset: any): Promise<void> {
    if (!this.sender) return;

    try {
      const params = this.sender.getParameters();
      
      if (params.encodings && params.encodings.length > 0) {
        const encoding = params.encodings[0];
        
        // Update bitrate
        if (this.config.enableAdaptiveBitrate) {
          encoding.maxBitrate = preset.bitrate * 1000; // Convert to bps
          encoding.minBitrate = Math.max(this.config.minBitrate * 1000, preset.bitrate * 500);
        }

        // Update frame rate
        encoding.maxFramerate = preset.frameRate;

        // Update resolution scaling
        if (this.config.enableResolutionScaling) {
          const track = this.sender.track;
          if (track && track.kind === 'video') {
            const constraints = {
              width: { ideal: preset.width },
              height: { ideal: preset.height },
              frameRate: { ideal: preset.frameRate }
            };
            
            await track.applyConstraints(constraints);
          }
        }

        await this.sender.setParameters(params);
      }
    } catch (error) {
      console.error('Failed to adapt video parameters:', error);
    }
  }

  /**
   * Manually set video quality preset
   */
  async setQualityPreset(quality: keyof typeof this.qualityPresets): Promise<void> {
    const preset = this.qualityPresets[quality];
    await this.adaptVideoParameters(preset);
    this.stats.adaptationCount++;
    console.log(`Manual quality preset applied: ${quality}`, preset);
  }

  /**
   * Get optimal video constraints for WebRTC
   */
  static getOptimalVideoConstraints(config: VideoQualityConfig): MediaTrackConstraints {
    return {
      width: { ideal: 1280, max: 1920, min: 320 },
      height: { ideal: 720, max: 1080, min: 240 },
      frameRate: { 
        ideal: config.targetFrameRate, 
        max: config.targetFrameRate,
        min: 15 
      },
      facingMode: 'user',
      // Advanced constraints for supported browsers
      ...(VideoQualityOptimizer.supportsAdvancedConstraints() && {
        googNoiseReduction: true,
        googFrameRate: config.targetFrameRate,
        googMaxFrameRate: config.targetFrameRate,
        googMinFrameRate: 15
      })
    };
  }

  /**
   * Check if browser supports advanced video constraints
   */
  private static supportsAdvancedConstraints(): boolean {
    return 'webkitGetUserMedia' in navigator;
  }

  /**
   * Set statistics update callback
   */
  onStats(callback: (stats: VideoStats) => void): void {
    this.onStatsUpdate = callback;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<VideoQualityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Video optimizer configuration updated:', this.config);
  }

  /**
   * Get current video statistics
   */
  getStats(): VideoStats {
    return { ...this.stats };
  }

  /**
   * Get current network conditions
   */
  async getNetworkConditions(): Promise<NetworkCondition> {
    return await this.detectNetworkConditions();
  }

  /**
   * Check if video optimization is supported
   */
  static isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Stop optimization and clean up resources
   */
  dispose(): void {
    this.isOptimizing = false;
    
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }

    this.peerConnection = null;
    this.sender = null;
    this.adaptationHistory = [];
    
    console.log('Video quality optimizer disposed');
  }
}

// Default configuration for high-quality video optimization
export const DEFAULT_VIDEO_CONFIG: VideoQualityConfig = {
  enableAdaptiveBitrate: true,
  enableResolutionScaling: true,
  targetFrameRate: 30,
  maxBitrate: 2500, // 2.5 Mbps
  minBitrate: 300,  // 300 kbps
  preferredCodec: 'vp9',
  adaptationMode: 'automatic'
};