/**
 * ThinkingIndicator Component
 * Shows AI reasoning/thinking process
 */

import { Card } from '@/components/ui/card';

interface ThinkingIndicatorProps {
  message?: string;
}

export function ThinkingIndicator({ message = 'Thinking...' }: ThinkingIndicatorProps) {
  return (
    <Card className="p-3 bg-orange-50 dark:bg-orange-950 border-2 border-orange-200 dark:border-orange-800">
      <div className="flex items-center gap-3">
        <span className="text-xl animate-pulse">⭐</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {message}
          </p>
        </div>
      </div>
    </Card>
  );
}
