'use client';

import { useState, useCallback } from 'react';

export interface VoiceUploadResponse {
  clone_id: string;
  voice_id: string;
  voice_name: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  message: string;
}

export interface VoiceUploadOptions {
  voiceName?: string;
  description?: string;
}

export interface VoiceTestOptions {
  text: string;
}

export function useVoiceUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadVoice = useCallback(async (
    cloneId: string,
    file: File,
    options: VoiceUploadOptions = {}
  ): Promise<VoiceUploadResponse> => {
    if (!cloneId || !file) {
      throw new Error('Clone ID and file are required');
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (options.voiceName) {
        formData.append('voice_name', options.voiceName);
      }
      
      if (options.description) {
        formData.append('description', options.description);
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/clones/${cloneId}/voice/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(errorData.detail || `Upload failed with status ${response.status}`);
      }

      const result: VoiceUploadResponse = await response.json();
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setError(errorMessage);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const testVoice = useCallback(async (
    cloneId: string,
    options: VoiceTestOptions
  ): Promise<Blob> => {
    if (!cloneId || !options.text?.trim()) {
      throw new Error('Clone ID and text are required');
    }

    setIsTesting(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/clones/${cloneId}/voice/test?text=${encodeURIComponent(options.text)}`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Voice test failed' }));
        throw new Error(errorData.detail || `Voice test failed with status ${response.status}`);
      }

      const audioBlob = await response.blob();
      return audioBlob;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Voice test failed';
      setError(errorMessage);
      throw error;
    } finally {
      setIsTesting(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    uploadVoice,
    testVoice,
    isUploading,
    isTesting,
    error,
    clearError
  };
}