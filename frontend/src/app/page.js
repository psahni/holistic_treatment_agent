'use client'
import { useState } from 'react'
import ChatInterface from '@/components/ChatInterface'
import HeroSection from '@/components/HeroSection'

export default function Home() {
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionId, setSessionId] = useState(null)

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!sessionStarted ? (
        <HeroSection onStart={(id) => { setSessionId(id); setSessionStarted(true) }} />
      ) : (
        <ChatInterface sessionId={sessionId} />
      )}
    </main>
  )
}
