'use client';

import dynamic from 'next/dynamic'

// Create a client-only settings component
const ClientSettingsPage = dynamic(() => import('./settings-client'), {
  loading: () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div>Loading settings...</div>
    </div>
  )
})

export default function SettingsPage() {
  return <ClientSettingsPage />
}
