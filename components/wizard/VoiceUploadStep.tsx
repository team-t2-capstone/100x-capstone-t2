'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Mic, Play, Square, AlertCircle, CheckCircle } from 'lucide-react';

interface VoiceUploadStepProps {
  cloneId: string;
  onVoiceUploaded?: (voiceId: string) => void;
}

interface VoiceUploadResponse {
  clone_id: string;
  voice_id: string;
  voice_name: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  message: string;
}

interface VoiceTestResponse {
  // Audio blob response from the server
}

export default function VoiceUploadStep({ cloneId, onVoiceUploaded }: VoiceUploadStepProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [voiceId, setVoiceId] = useState<string | null>(null);
  
  // Voice testing
  const [testText, setTestText] = useState('Hello, this is a test of my AI voice clone. How does this sound?');
  const [isTesting, setIsTesting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const supportedFormats = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/x-mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/flac'];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      if (!supportedFormats.includes(file.type)) {
        setUploadMessage('Please select a valid audio file (WAV, MP3, M4A, AAC, OGG, FLAC)');
        setUploadStatus('error');
        return;
      }
      
      // Check file size (25MB limit)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        setUploadMessage('File size must be less than 25MB');
        setUploadStatus('error');
        return;
      }
      
      setSelectedFile(file);
      setUploadStatus('idle');
      setUploadMessage('');
      
      // Auto-populate voice name if not set
      if (!voiceName) {
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        setVoiceName(`${fileName} Voice Clone`);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !cloneId) return;

    setIsUploading(true);
    setUploadStatus('idle');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (voiceName) formData.append('voice_name', voiceName);
      if (description) formData.append('description', description);

      const response = await fetch(`/api/clones/${cloneId}/voice/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Adjust token retrieval as needed
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result: VoiceUploadResponse = await response.json();
      
      setVoiceId(result.voice_id);
      setUploadStatus('success');
      setUploadMessage(result.message);
      
      // Notify parent component
      if (onVoiceUploaded) {
        onVoiceUploaded(result.voice_id);
      }

    } catch (error) {
      console.error('Voice upload error:', error);
      setUploadStatus('error');
      setUploadMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTestVoice = async () => {
    if (!voiceId || !testText.trim()) return;

    setIsTesting(true);

    try {
      const response = await fetch(`/api/clones/${cloneId}/voice/test?text=${encodeURIComponent(testText)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Adjust token retrieval as needed
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Test failed' }));
        throw new Error(errorData.detail || 'Voice test failed');
      }

      // Get audio blob from response
      const audioBlob = await response.blob();
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
        setUploadMessage('Failed to play generated audio');
        setUploadStatus('error');
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();

    } catch (error) {
      console.error('Voice test error:', error);
      setUploadMessage(error instanceof Error ? error.message : 'Voice test failed');
      setUploadStatus('error');
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
    setDescription('');
    setUploadStatus('idle');
    setUploadMessage('');
    setVoiceId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Voice Clone Upload
          </CardTitle>
          <CardDescription>
            Upload a clear audio sample (10+ seconds) to create a unique AI voice for your clone.
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
                disabled={isUploading || uploadStatus === 'success'}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || uploadStatus === 'success'}
              >
                <Upload className="h-4 w-4 mr-1" />
                Browse
              </Button>
            </div>
            {selectedFile && (
              <div className="text-sm text-gray-600">
                Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </div>
            )}
          </div>

          {/* Voice Name Input */}
          <div className="space-y-2">
            <Label htmlFor="voice-name">Voice Name (Optional)</Label>
            <Input
              id="voice-name"
              type="text"
              placeholder="e.g., Alex Professional Voice"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              disabled={isUploading || uploadStatus === 'success'}
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              type="text"
              placeholder="Brief description of the voice characteristics"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading || uploadStatus === 'success'}
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
                  disabled={!selectedFile || isUploading}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload & Clone Voice
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isUploading}
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
              >
                Upload Another Sample
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Voice Test Section */}
      {uploadStatus === 'success' && voiceId && (
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
              <textarea
                id="test-text"
                className="w-full min-h-[80px] px-3 py-2 border rounded-md resize-none"
                placeholder="Enter text to test your voice clone..."
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                disabled={isTesting || isPlaying}
                maxLength={1000}
              />
              <div className="text-xs text-gray-500 text-right">
                {testText.length}/1000 characters
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleTestVoice}
                disabled={!testText.trim() || isTesting || isPlaying}
                className="flex-1"
              >
                {isTesting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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