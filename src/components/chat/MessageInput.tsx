'use client'

import { useState, KeyboardEvent } from 'react'
import { useChatStore } from '@/stores/chat'
import { Send, Paperclip, Smile } from 'lucide-react'

interface MessageInputProps {
  conversationId: string
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const { sendMessage } = useChatStore()

  const handleSend = async () => {
    if (!message.trim() || isSending) return

    setIsSending(true)
    try {
      await sendMessage(conversationId, message.trim())
      setMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-4 border-t border-gray-200 bg-white">
      <div className="flex items-end gap-3">
        {/* Attachment button */}
        <button 
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          title="Attach file"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        {/* Message input */}
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="w-full px-4 py-2 pr-12 text-sm border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            style={{
              minHeight: '40px',
              maxHeight: '120px',
              overflowY: message.split('\n').length > 3 ? 'scroll' : 'hidden'
            }}
            disabled={isSending}
          />
          
          {/* Emoji button */}
          <button 
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Add emoji"
          >
            <Smile className="h-4 w-4" />
          </button>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || isSending}
          className={`p-2 rounded-full transition-colors ${
            message.trim() && !isSending
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          title="Send message"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>

      {/* Character count or status */}
      {message.length > 0 && (
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span>{message.length}/1000</span>
          {isSending && <span>Sending...</span>}
        </div>
      )}
    </div>
  )
}