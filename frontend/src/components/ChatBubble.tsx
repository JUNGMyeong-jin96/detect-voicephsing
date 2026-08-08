import type { ChatMessage } from '../api/types'

export function ChatBubble({ message }: { message: ChatMessage }) {
  const isPlayer = message.role === 'player'
  return (
    <div className={`mb-3 flex ${isPlayer ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          isPlayer ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-100'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
