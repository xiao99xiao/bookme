'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Smile } from 'lucide-react'

interface MessageInputProps {
  onSendMessage: (content: string) => void
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Type a message..." 
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [message])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedMessage = message.trim()
    if (!trimmedMessage || disabled) return

    onSendMessage(trimmedMessage)
    setMessage('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    // Handle file paste in future
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    setMessage(prev => prev + text)
  }

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        {/* Attachment button */}
        <button
          type="button"
          disabled={disabled}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
          title="Attach file"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        {/* Message input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="
              w-full px-4 py-2 pr-12 border border-gray-300 rounded-full resize-none
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              placeholder:text-gray-400
            "
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          
          {/* Emoji button */}
          <button
            type="button"
            disabled={disabled}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
            title="Add emoji"
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className="
            flex-shrink-0 p-2 bg-blue-500 text-white rounded-full
            hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          "
          title="Send message"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>

      {/* Character count for long messages */}
      {message.length > 100 && (
        <div className="mt-2 text-right">
          <span className={`text-xs ${message.length > 500 ? 'text-red-500' : 'text-gray-400'}`}>
            {message.length}/1000
          </span>
        </div>
      )}
    </div>
  )
}