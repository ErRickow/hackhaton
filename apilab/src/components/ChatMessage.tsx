/**
 * ChatMessage Component
 * Displays a single chat message (user or assistant)
 */

import { User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  if (isSystem) return null; // Don't display system messages

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg',
        isUser ? 'bg-primary/10' : 'bg-muted/50'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="font-semibold text-sm">
          {isUser ? 'You' : 'APILab Assistant'}
        </div>
        <div className="text-sm whitespace-pre-wrap break-words">
          {content || <span className="text-muted-foreground italic">Thinking...</span>}
        </div>
      </div>
    </div>
  );
}
