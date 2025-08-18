'use client'

import { Suspense } from 'react'
import { ChatLayout } from '@/components/chat/ChatLayout'

function ChatPageContent() {
  return <ChatLayout />
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          border: '2px solid var(--border-light)', 
          borderTop: '2px solid var(--accent-primary)', 
          borderRadius: '50%', 
          animation: 'spin 1s linear infinite' 
        }}></div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  )
}