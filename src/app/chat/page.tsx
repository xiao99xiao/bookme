'use client'

import { Suspense } from 'react'
import { ChatLayout } from '@/components/chat/ChatLayout'

function ChatPageContent() {
  return <ChatLayout />
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  )
}