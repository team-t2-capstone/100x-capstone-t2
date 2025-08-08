/**
 * Call Quality Monitor Component
 * Displays real-time audio/video quality metrics and processing status
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Signal, 
  Mic, 
  Video, 
  Wifi, 
  Volume2, 
  Settings,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Activity
} from 'lucide-react';
import { AudioStats } from '@/lib/audio-processor';
import { VideoStats } from '@/lib/video-optimizer';
import { CallQualityStats } from '@/lib/webrtc-client';

interface CallQualityMonitorProps {
  callQuality: CallQualityStats | null;
  audioStats: AudioStats | null;
  videoStats: VideoStats | null;
  processingEnabled: {
    audioProcessing: boolean;
    videoOptimization: boolean;
    noiseReduction: boolean;
    adaptiveBitrate: boolean;
  };
  onToggleProcessing: (feature: string, enabled?: boolean) => void;
  onSetVideoQuality?: (quality: 'excellent' | 'good' | 'fair' | 'poor') => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export function CallQualityMonitor({
  callQuality,
  audioStats,
  videoStats,
  processingEnabled,
  onToggleProcessing,
  onSetVideoQuality,
  isExpanded = false,
  onToggleExpanded
}: CallQualityMonitorProps) {
  
  // Calculate overall quality score
  const overallQuality = React.useMemo(() => {
    if (!callQuality) return 0;
    
    const connectionScore = callQuality.connectionQuality || 0;
    const audioScore = audioStats?.qualityScore || connectionScore;
    const videoScore = videoStats?.qualityScore || connectionScore;
    
    return Math.round((connectionScore + audioScore + videoScore) / 3);
  }, [callQuality, audioStats, videoStats]);

  // Get quality color and status
  const getQualityStatus = (score: number) => {
    if (score >= 90) return { color: 'text-green-600', bg: 'bg-green-100', status: 'Excellent', icon: CheckCircle };
    if (score >= 70) return { color: 'text-blue-600', bg: 'bg-blue-100', status: 'Good', icon: CheckCircle };
    if (score >= 50) return { color: 'text-yellow-600', bg: 'bg-yellow-100', status: 'Fair', icon: AlertTriangle };
    return { color: 'text-red-600', bg: 'bg-red-100', status: 'Poor', icon: AlertTriangle };
  };

  const qualityStatus = getQualityStatus(overallQuality);
  const StatusIcon = qualityStatus.icon;

  if (!callQuality) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-center text-slate-500">
            <Activity className="h-4 w-4 mr-2" />
            <span className="text-sm">Waiting for connection...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <StatusIcon className={`h-4 w-4 ${qualityStatus.color}`} />
            <CardTitle className="text-sm font-medium">Call Quality</CardTitle>
            <Badge variant="outline" className={`${qualityStatus.bg} ${qualityStatus.color} border-0`}>
              {qualityStatus.status} ({overallQuality}%)
            </Badge>
          </div>
          {onToggleExpanded && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onToggleExpanded}
              className="h-6 w-6 p-0"
            >
              <Settings className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main Quality Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <Signal className="h-4 w-4 mx-auto mb-1 text-slate-600" />
            <div className="text-xs text-slate-500">Connection</div>
            <div className="font-medium">{callQuality.connectionQuality}%</div>
          </div>
          
          <div className="text-center">
            <Mic className="h-4 w-4 mx-auto mb-1 text-slate-600" />
            <div className="text-xs text-slate-500">Audio</div>
            <div className="font-medium">{audioStats?.qualityScore || callQuality.connectionQuality}%</div>
          </div>
          
          <div className="text-center">
            <Video className="h-4 w-4 mx-auto mb-1 text-slate-600" />
            <div className="text-xs text-slate-500">Video</div>
            <div className="font-medium">{videoStats?.qualityScore || callQuality.connectionQuality}%</div>
          </div>
        </div>

        {/* Network Stats */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="flex items-center space-x-1">
            <Wifi className="h-3 w-3 text-slate-500" />
            <span className="text-slate-500">Latency:</span>
            <span className="font-medium">{callQuality.latency}ms</span>
          </div>
          <div className="flex items-center space-x-1">
            <TrendingUp className="h-3 w-3 text-slate-500" />
            <span className="text-slate-500">Bandwidth:</span>
            <span className="font-medium">{callQuality.bandwidth} kbps</span>
          </div>
        </div>

        {/* Audio Level Indicator */}
        {audioStats && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Audio Level</span>
              <span className="font-medium">{audioStats.inputLevel}%</span>
            </div>
            <Progress value={audioStats.inputLevel} className="h-2" />
          </div>
        )}

        {/* Expanded Controls */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t">
            {/* Processing Controls */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Processing Options</h4>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Noise Reduction</span>
                  <Switch
                    checked={processingEnabled.noiseReduction}
                    onCheckedChange={(checked) => onToggleProcessing('noiseReduction', checked)}
                    size="sm"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Audio Processing</span>
                  <Switch
                    checked={processingEnabled.audioProcessing}
                    onCheckedChange={(checked) => onToggleProcessing('audioProcessing', checked)}
                    size="sm"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Video Optimization</span>
                  <Switch
                    checked={processingEnabled.videoOptimization}
                    onCheckedChange={(checked) => onToggleProcessing('videoOptimization', checked)}
                    size="sm"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Adaptive Bitrate</span>
                  <Switch
                    checked={processingEnabled.adaptiveBitrate}
                    onCheckedChange={(checked) => onToggleProcessing('adaptiveBitrate', checked)}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* Manual Video Quality Control */}
            {onSetVideoQuality && videoStats && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Video Quality</h4>
                <div className="grid grid-cols-2 gap-2">
                  {(['excellent', 'good', 'fair', 'poor'] as const).map((quality) => (
                    <Button
                      key={quality}
                      variant="outline"
                      size="sm"
                      onClick={() => onSetVideoQuality(quality)}
                      className="text-xs capitalize"
                    >
                      {quality}
                    </Button>
                  ))}
                </div>
                
                <div className="text-xs text-slate-500">
                  Current: {videoStats.currentResolution.width}×{videoStats.currentResolution.height} @ {videoStats.currentFrameRate}fps
                </div>
              </div>
            )}

            {/* Detailed Stats */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Detailed Metrics</h4>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                {audioStats && (
                  <>
                    <div>
                      <span className="text-slate-500">Noise Level:</span>
                      <span className="font-medium ml-1">{audioStats.noiseLevel.toFixed(1)} dB</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Audio Quality:</span>
                      <span className="font-medium ml-1">{audioStats.qualityScore}%</span>
                    </div>
                  </>
                )}
                
                {videoStats && (
                  <>
                    <div>
                      <span className="text-slate-500">Video Bitrate:</span>
                      <span className="font-medium ml-1">{videoStats.currentBitrate} kbps</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Adaptations:</span>
                      <span className="font-medium ml-1">{videoStats.adaptationCount}</span>
                    </div>
                  </>
                )}
                
                <div>
                  <span className="text-slate-500">Packets Lost:</span>
                  <span className="font-medium ml-1">{callQuality.packetsLost}</span>
                </div>
                <div>
                  <span className="text-slate-500">Total Packets:</span>
                  <span className="font-medium ml-1">{callQuality.totalPackets}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for overlay display during calls
export function CallQualityIndicator({
  overallQuality,
  audioLevel,
  connectionState
}: {
  overallQuality: number;
  audioLevel: number;
  connectionState: string;
}) {
  const qualityStatus = React.useMemo(() => {
    if (overallQuality >= 90) return { color: 'bg-green-500', status: 'Excellent' };
    if (overallQuality >= 70) return { color: 'bg-blue-500', status: 'Good' };
    if (overallQuality >= 50) return { color: 'bg-yellow-500', status: 'Fair' };
    return { color: 'bg-red-500', status: 'Poor' };
  }, [overallQuality]);

  return (
    <div className="flex items-center space-x-2 bg-black/50 rounded-full px-3 py-1">
      <div className={`w-2 h-2 rounded-full ${qualityStatus.color}`} />
      <span className="text-white text-xs font-medium">{overallQuality}%</span>
      {audioLevel > 0 && (
        <>
          <Volume2 className="h-3 w-3 text-white" />
          <div className="w-8 h-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{ width: `${audioLevel}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}