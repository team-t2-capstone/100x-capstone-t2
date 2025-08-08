/**
 * Advanced Audio Processing for WebRTC Calls
 * Implements noise reduction, audio enhancement, and quality optimization
 */

export interface AudioProcessingConfig {
  enableNoiseSuppression: boolean;
  enableEchoCancellation: boolean;
  enableAutoGainControl: boolean;
  enableAdvancedProcessing: boolean;
  noiseSuppressionLevel: 'low' | 'medium' | 'high';
  gainControlMode: 'adaptive' | 'fixed';
}

export interface AudioStats {
  inputLevel: number;
  outputLevel: number;
  noiseLevel: number;
  echoCancellationReturn: number;
  gainControlCompression: number;
  qualityScore: number;
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private analyzerNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private noiseGateNode: GainNode | null = null;

  private isInitialized = false;
  private isProcessing = false;
  private config: AudioProcessingConfig;
  private stats: AudioStats = {
    inputLevel: 0,
    outputLevel: 0,
    noiseLevel: 0,
    echoCancellationReturn: 0,
    gainControlCompression: 0,
    qualityScore: 0
  };

  private animationFrame: number | null = null;
  private onStatsUpdate?: (stats: AudioStats) => void;

  constructor(config: AudioProcessingConfig) {
    this.config = config;
  }

  /**
   * Initialize audio processing context
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Resume audio context if suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isInitialized = true;
      console.log('Audio processor initialized');
    } catch (error) {
      console.error('Failed to initialize audio processor:', error);
      throw error;
    }
  }

  /**
   * Process audio stream with noise reduction and enhancement
   */
  async processStream(inputStream: MediaStream): Promise<MediaStream> {
    if (!this.isInitialized || !this.audioContext) {
      throw new Error('Audio processor not initialized');
    }

    try {
      // Create audio processing chain
      this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      this.analyzerNode = this.audioContext.createAnalyser();
      this.gainNode = this.audioContext.createGain();
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.filterNode = this.audioContext.createBiquadFilter();
      this.noiseGateNode = this.audioContext.createGain();

      // Configure analyzer for audio monitoring
      this.analyzerNode.fftSize = 2048;
      this.analyzerNode.smoothingTimeConstant = 0.8;

      // Configure dynamic range compressor for consistent audio levels
      this.compressorNode.threshold.setValueAtTime(-24, this.audioContext.currentTime);
      this.compressorNode.knee.setValueAtTime(30, this.audioContext.currentTime);
      this.compressorNode.ratio.setValueAtTime(12, this.audioContext.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      this.compressorNode.release.setValueAtTime(0.25, this.audioContext.currentTime);

      // Configure high-pass filter for noise reduction
      this.filterNode.type = 'highpass';
      this.filterNode.frequency.setValueAtTime(200, this.audioContext.currentTime);
      this.filterNode.Q.setValueAtTime(1, this.audioContext.currentTime);

      // Configure gain control
      this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

      // Create advanced processing chain
      if (this.config.enableAdvancedProcessing) {
        // Chain: Source -> Filter -> Noise Gate -> Compressor -> Gain -> Analyzer -> Destination
        this.sourceNode.connect(this.filterNode);
        this.filterNode.connect(this.noiseGateNode);
        this.noiseGateNode.connect(this.compressorNode);
        this.compressorNode.connect(this.gainNode);
        this.gainNode.connect(this.analyzerNode);
        this.analyzerNode.connect(this.destinationNode);
      } else {
        // Simple chain: Source -> Gain -> Analyzer -> Destination
        this.sourceNode.connect(this.gainNode);
        this.gainNode.connect(this.analyzerNode);
        this.analyzerNode.connect(this.destinationNode);
      }

      // Start audio monitoring
      this.startAudioMonitoring();
      this.isProcessing = true;

      console.log('Audio processing chain established');
      return this.destinationNode.stream;

    } catch (error) {
      console.error('Failed to process audio stream:', error);
      throw error;
    }
  }

  /**
   * Apply noise gate to reduce background noise
   */
  private applyNoiseGate(threshold: number = -40): void {
    if (!this.noiseGateNode || !this.analyzerNode || !this.audioContext) return;

    const bufferLength = this.analyzerNode.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    const updateGate = () => {
      if (!this.isProcessing) return;

      this.analyzerNode!.getFloatFrequencyData(dataArray);
      
      // Calculate average power
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const averagePower = sum / bufferLength;

      // Apply noise gate
      const gateValue = averagePower > threshold ? 1.0 : 0.1;
      this.noiseGateNode!.gain.setTargetAtTime(
        gateValue, 
        this.audioContext!.currentTime, 
        0.01
      );

      // Update noise level in stats
      this.stats.noiseLevel = Math.max(0, threshold - averagePower);

      setTimeout(updateGate, 100); // Update every 100ms
    };

    updateGate();
  }

  /**
   * Start real-time audio monitoring and statistics
   */
  private startAudioMonitoring(): void {
    if (!this.analyzerNode) return;

    const bufferLength = this.analyzerNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const frequencyArray = new Float32Array(bufferLength);

    const updateStats = () => {
      if (!this.isProcessing || !this.analyzerNode) return;

      // Get time domain data for level analysis
      this.analyzerNode.getByteTimeDomainData(dataArray);
      this.analyzerNode.getFloatFrequencyData(frequencyArray);

      // Calculate audio levels
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const amplitude = (dataArray[i] - 128) / 128;
        sum += amplitude * amplitude;
      }
      const rms = Math.sqrt(sum / bufferLength);
      
      // Update input level (0-100)
      this.stats.inputLevel = Math.round(rms * 100);

      // Calculate frequency-based quality metrics
      let lowFreqSum = 0, midFreqSum = 0, highFreqSum = 0;
      const third = bufferLength / 3;
      
      for (let i = 0; i < bufferLength; i++) {
        const power = Math.pow(10, frequencyArray[i] / 20);
        if (i < third) lowFreqSum += power;
        else if (i < third * 2) midFreqSum += power;
        else highFreqSum += power;
      }

      // Calculate quality score based on frequency distribution
      const totalPower = lowFreqSum + midFreqSum + highFreqSum;
      if (totalPower > 0) {
        const balance = Math.min(midFreqSum / totalPower * 3, 1);
        const clarity = Math.min(highFreqSum / totalPower * 5, 1);
        this.stats.qualityScore = Math.round((balance + clarity) * 50);
      }

      // Apply noise gate if advanced processing is enabled
      if (this.config.enableAdvancedProcessing) {
        const noiseThreshold = this.config.noiseSuppressionLevel === 'high' ? -45 : 
                              this.config.noiseSuppressionLevel === 'medium' ? -40 : -35;
        this.applyNoiseGate(noiseThreshold);
      }

      // Notify listeners
      if (this.onStatsUpdate) {
        this.onStatsUpdate({ ...this.stats });
      }

      this.animationFrame = requestAnimationFrame(updateStats);
    };

    updateStats();
  }

  /**
   * Adjust gain dynamically based on input level
   */
  adjustGain(targetLevel: number = 50): void {
    if (!this.gainNode || !this.audioContext) return;

    const currentLevel = this.stats.inputLevel;
    const difference = targetLevel - currentLevel;
    
    if (Math.abs(difference) > 5) { // Only adjust if significant difference
      const gainAdjustment = difference * 0.02; // Gentle adjustment
      const newGain = Math.max(0.1, Math.min(3.0, this.gainNode.gain.value + gainAdjustment));
      
      this.gainNode.gain.setTargetAtTime(
        newGain,
        this.audioContext.currentTime,
        0.1 // Smooth transition over 100ms
      );
    }
  }

  /**
   * Set statistics update callback
   */
  onStats(callback: (stats: AudioStats) => void): void {
    this.onStatsUpdate = callback;
  }

  /**
   * Update processing configuration
   */
  updateConfig(newConfig: Partial<AudioProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Apply configuration changes
    if (this.compressorNode && newConfig.gainControlMode) {
      if (newConfig.gainControlMode === 'adaptive') {
        this.compressorNode.ratio.setValueAtTime(8, this.audioContext!.currentTime);
      } else {
        this.compressorNode.ratio.setValueAtTime(4, this.audioContext!.currentTime);
      }
    }
  }

  /**
   * Get current audio statistics
   */
  getStats(): AudioStats {
    return { ...this.stats };
  }

  /**
   * Check if audio processing is supported
   */
  static isSupported(): boolean {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }

  /**
   * Get optimal audio constraints for WebRTC
   */
  static getOptimalAudioConstraints(): MediaTrackConstraints {
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1, // Mono for better processing
      sampleRate: { ideal: 48000 },
      sampleSize: { ideal: 16 },
      latency: { ideal: 0.01 }, // 10ms latency
      // Advanced constraints for supported browsers
      ...(AudioProcessor.supportsAdvancedConstraints() && {
        googEchoCancellation: true,
        googAutoGainControl: true,
        googNoiseSuppression: true,
        googHighpassFilter: true,
        googAudioMirroring: false
      })
    };
  }

  /**
   * Check if browser supports advanced audio constraints
   */
  private static supportsAdvancedConstraints(): boolean {
    return 'webkitGetUserMedia' in navigator;
  }

  /**
   * Clean up audio processing resources
   */
  dispose(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.isProcessing = false;

    // Disconnect audio nodes
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.destinationNode) {
      this.destinationNode.disconnect();
      this.destinationNode = null;
    }

    // Clean up other nodes
    [this.analyzerNode, this.gainNode, this.compressorNode, this.filterNode, this.noiseGateNode]
      .forEach(node => {
        if (node) {
          node.disconnect();
        }
      });

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isInitialized = false;
    console.log('Audio processor disposed');
  }
}

// Default configuration for high-quality audio processing
export const DEFAULT_AUDIO_CONFIG: AudioProcessingConfig = {
  enableNoiseSuppression: true,
  enableEchoCancellation: true,
  enableAutoGainControl: true,
  enableAdvancedProcessing: true,
  noiseSuppressionLevel: 'high',
  gainControlMode: 'adaptive'
};