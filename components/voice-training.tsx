'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { createClient } from '@/utils/supabase/client';
import { getAuthTokens } from '@/lib/api-client';
import { Upload, Mic, Play, Square, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';

interface VoiceTrainingProps {
  onVoiceCloned?: (voiceId: string, voiceName: string) => void;
  enableTesting?: boolean;
  initialVoiceId?: string;
  disabled?: boolean;
  cloneId?: string; // If provided, uses clone-specific endpoint
}

interface VoiceCloneResponse {
  success: boolean;
  voice_id: string;
  voice_name: string;
  message: string;
}

export function VoiceTraining({ 
  onVoiceCloned, 
  enableTesting = true, 
  initialVoiceId,
  disabled = false,
  cloneId
}: VoiceTrainingProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [voiceId, setVoiceId] = useState<string | null>(initialVoiceId || null);
  
  // Voice testing
  const [testText, setTestText] = useState('Hello, this is a test of my AI voice clone. How does this sound?');
  const [isTesting, setIsTesting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Supabase client lazily to ensure it only happens on the client side
  const [supabaseClient] = useState(() => createClient());

  // Helper function to get authentication token
  const getAuthToken = async (): Promise<string | null> => {
    // First try cookies
    let token = getAuthTokens().accessToken || null;
    
    // If no token in cookies, try Supabase session
    if (!token) {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session?.access_token) {
          token = session.access_token;
        }
      } catch (error) {
        console.error('Failed to get Supabase session:', error);
      }
    }
    
    return token;
  };

  const supportedFormats = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/x-mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/flac'];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      if (!supportedFormats.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a valid audio file (WAV, MP3, M4A, AAC, OGG, FLAC)",
          variant: "destructive",
        });
        return;
      }
      
      // Check file size (25MB limit)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "Audio file must be less than 25MB",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
      setUploadStatus('idle');
      setUploadMessage('');
      
      // Auto-populate voice name if not set
      if (!voiceName) {
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        setVoiceName(`${fileName}_Voice_Clone`);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !voiceName.trim()) return;

    setIsUploading(true);
    setUploadStatus('idle');
    setUploadMessage('');

    try {
      const formData = new FormData();
      if (cloneId) {
        // Clone-specific endpoint expects 'file' parameter
        formData.append('file', selectedFile);
        formData.append('voice_name', voiceName.trim());
        formData.append('description', `AI voice clone for ${voiceName.trim()}`);
      } else {
        // General voice endpoint expects 'audio_files' parameter
        formData.append('audio_files', selectedFile);
        formData.append('voice_name', voiceName.trim());
      }

      // Get authentication token
      const token = await getAuthToken();
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      // Use clone-specific endpoint if cloneId is provided, otherwise use general voice endpoint
      const apiUrl = cloneId 
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/clones/${cloneId}/voice/upload`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/voice/clone-voice`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        signal: controller.signal
      }).catch((error) => {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. Please check if the backend is running.');
        }
        if (error.message.includes('fetch')) {
          throw new Error('Failed to connect to voice cloning service. Please check if the backend is running.');
        }
        throw error;
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = 'Voice cloning failed';
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          if (response.status === 401 || response.status === 403) {
            errorMessage = 'Not authenticated. Please log in to use voice cloning.';
          } else if (response.status === 404) {
            errorMessage = 'Voice cloning endpoint not found. Please check if the backend is properly configured.';
          } else if (response.status === 500) {
            errorMessage = 'Server error during voice cloning. Please try again.';
          } else if (response.status >= 400) {
            errorMessage = `Voice cloning failed with status ${response.status}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const result: VoiceCloneResponse = await response.json().catch(() => {
        throw new Error('Invalid response format from voice cloning service');
      });
      
      setVoiceId(result.voice_id);
      setUploadStatus('success');
      setUploadMessage(result.message);
      
      toast({
        title: "Voice cloned successfully",
        description: `Voice "${result.voice_name}" is ready for testing!`,
      });
      
      // Notify parent component
      if (onVoiceCloned) {
        onVoiceCloned(result.voice_id, result.voice_name);
      }

    } catch (error) {
      console.error('Voice cloning error:', error);
      setUploadStatus('error');
      setUploadMessage(error instanceof Error ? error.message : 'Voice cloning failed');
      
      toast({
        title: "Voice cloning failed",
        description: error instanceof Error ? error.message : 'Please try again',
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTestVoice = async () => {
    if (!voiceId || !testText.trim()) return;

    setIsTesting(true);

    try {
      const formData = new FormData();
      formData.append('text', testText.trim());
      formData.append('voice_id', voiceId);

      // Get authentication token
      const token = await getAuthToken();
      
      // Add timeout for voice testing
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout for audio generation

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/voice/test-voice`, {
        method: 'POST',
        body: formData,
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        signal: controller.signal
      }).catch((error) => {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Voice generation timed out. Please try with shorter text.');
        }
        if (error.message.includes('fetch')) {
          throw new Error('Failed to connect to voice testing service. Please check if the backend is running.');
        }
        throw error;
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = 'Voice test failed';
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          if (response.status === 401 || response.status === 403) {
            errorMessage = 'Not authenticated. Please log in to use voice testing.';
          } else if (response.status === 404) {
            errorMessage = 'Voice testing endpoint not found. Please check if the backend is properly configured.';
          } else if (response.status === 500) {
            errorMessage = 'Server error during voice generation. Please try again.';
          } else if (response.status >= 400) {
            errorMessage = `Voice test failed with status ${response.status}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      // Get audio blob from response
      const audioBlob = await response.blob().catch(() => {
        throw new Error('Failed to process generated audio');
      });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      
      // Create and play new audio
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      setIsPlaying(true);
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        toast({
          title: "Playback failed",
          description: "Failed to play generated audio",
          variant: "destructive",
        });
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();

    } catch (error) {
      console.error('Voice test error:', error);
      toast({
        title: "Voice test failed",
        description: error instanceof Error ? error.message : 'Please try again',
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setVoiceName('');
    setUploadStatus('idle');
    setUploadMessage('');
    setVoiceId(initialVoiceId || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Voice Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Voice Training
          </CardTitle>
          <CardDescription>
            Upload a clear audio sample (2-3 minutes recommended) to create your AI voice clone.
            Best results with high-quality recordings in WAV or MP3 format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload Section */}
          <div className="space-y-2">
            <Label htmlFor="voice-file">Audio File</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                id="voice-file"
                type="file"
                accept={supportedFormats.join(',')}
                onChange={handleFileSelect}
                disabled={isUploading || uploadStatus === 'success' || disabled}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || uploadStatus === 'success' || disabled}
              >
                <Upload className="h-4 w-4 mr-1" />
                Browse
              </Button>
            </div>
            {selectedFile && (
              <div className="text-sm text-gray-600 flex items-center justify-between">
                <span>Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  disabled={isUploading || disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Voice Name Input */}
          <div className="space-y-2">
            <Label htmlFor="voice-name">Voice Name</Label>
            <Input
              id="voice-name"
              type="text"
              placeholder="e.g., Alex Professional Voice"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              disabled={isUploading || uploadStatus === 'success' || disabled}
              maxLength={50}
            />
          </div>

          {/* Upload Status */}
          {uploadMessage && (
            <Alert className={uploadStatus === 'error' ? 'border-red-200 bg-red-50' : uploadStatus === 'success' ? 'border-green-200 bg-green-50' : ''}>
              <div className="flex items-center gap-2">
                {uploadStatus === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                {uploadStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                <AlertDescription className={uploadStatus === 'error' ? 'text-red-700' : uploadStatus === 'success' ? 'text-green-700' : ''}>
                  {uploadMessage}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {uploadStatus !== 'success' ? (
              <>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !voiceName.trim() || isUploading || disabled}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cloning Voice...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Clone Voice
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isUploading || disabled}
                >
                  Reset
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="w-full"
                disabled={disabled}
              >
                Upload Another Sample
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Voice Test Section */}
      {enableTesting && (uploadStatus === 'success' || voiceId) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Test Your Voice Clone
            </CardTitle>
            <CardDescription>
              Enter some text to hear how your cloned voice sounds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-text">Test Text</Label>
              <Textarea
                id="test-text"
                className="min-h-[80px] resize-none"
                placeholder="Enter text to test your voice clone..."
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                disabled={isTesting || isPlaying || disabled}
                maxLength={500}
              />
              <div className="text-xs text-gray-500 text-right">
                {testText.length}/500 characters
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleTestVoice}
                disabled={!testText.trim() || isTesting || isPlaying || disabled}
                className="flex-1"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Test Voice
                  </>
                )}
              </Button>
              
              {isPlaying && (
                <Button
                  onClick={stopAudio}
                  variant="outline"
                  disabled={disabled}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}