/**
 * ThinkingIndicator Component
 * Shows AI reasoning/thinking process
 */

import { Card } from '@/components/ui/card';
import { Loader2, Sparkles } from 'lucide-react';

interface ThinkingIndicatorProps {
  message?: string;
}

export function ThinkingIndicator({ message = 'Thinking...' }: ThinkingIndicatorProps) {
  return (
    <Card className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400 animate-pulse" />
          <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin absolute -top-1 -right-1" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
            {message}
          </p>
        </div>
      </div>
    </Card>
  );
}
