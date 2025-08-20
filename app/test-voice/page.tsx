'use client';

import { VoiceTraining } from '@/components/voice-training';

export default function TestVoicePage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Voice Training Test</h1>
      <VoiceTraining
        onVoiceCloned={(voiceId, voiceName) => {
          console.log('Voice cloned:', { voiceId, voiceName });
        }}
      />
    </div>
  );
}