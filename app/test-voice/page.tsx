'use client';

import dynamic from 'next/dynamic';

// Dynamically import the VoiceTraining component with SSR disabled
const VoiceTraining = dynamic(
  () => import('@/components/voice-training').then((mod) => mod.VoiceTraining),
  { ssr: false }
);

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