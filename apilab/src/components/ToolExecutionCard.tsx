/**
 * ToolExecutionCard Component
 * Shows tool execution with detailed status
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';

export type ToolStatus = 'pending' | 'running' | 'complete' | 'error';

interface ToolExecutionCardProps {
  toolName: string;
  status: ToolStatus;
  args?: Record<string, any>;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export function ToolExecutionCard({
  toolName,
  status,
  args,
  result,
  error,
  startTime,
  endTime,
}: ToolExecutionCardProps) {
  const [isExpanded, setIsExpanded] = useState(status === 'running' || status === 'error');

  // Auto-expand when args change (tool is ready to execute)
  useEffect(() => {
    if (status === 'running' && args && Object.keys(args).length > 0) {
      setIsExpanded(true);
    }
  }, [status, args]);

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />;
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'border-2 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30';
      case 'running':
        return 'border-2 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30 shadow-lg shadow-blue-500/20';
      case 'complete':
        return 'border-2 border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/30';
      case 'error':
        return 'border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Queued';
      case 'running':
        return 'Executing';
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Failed';
    }
  };

  const getDuration = () => {
    if (startTime && endTime) {
      return `${endTime - startTime}ms`;
    }
    return null;
  };

  const formatJson = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <Card className={`p-3 ${getStatusColor()} transition-all`}>
      {/* Header - Always visible */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 flex-1">
          {getStatusIcon()}
          <Zap className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm font-mono font-medium">{toolName}</span>
          <Badge variant="outline" className="text-xs">
            {getStatusText()}
          </Badge>
          {getDuration() && (
            <span className="text-xs text-muted-foreground">{getDuration()}</span>
          )}
        </div>
        <div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Details - Expandable */}
      {isExpanded && (
        <div className="mt-3 space-y-2 pl-9">
          {/* Arguments */}
          {args && Object.keys(args).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Arguments:</p>
              <div className="bg-background/50 rounded p-2">
                <pre className="text-xs font-mono overflow-x-auto">{formatJson(args)}</pre>
              </div>
            </div>
          )}

          {/* Result */}
          {result && status === 'complete' && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Result:</p>
              <div className="bg-background/50 rounded p-2 max-h-48 overflow-y-auto">
                <pre className="text-xs font-mono overflow-x-auto">{formatJson(result)}</pre>
              </div>
            </div>
          )}

          {/* Error */}
          {error && status === 'error' && (
            <div>
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Error:</p>
              <div className="bg-red-100 dark:bg-red-900/20 rounded p-2">
                <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Running message */}
          {status === 'running' && (
            <div className="space-y-1">
              <p className="text-xs text-blue-700 dark:text-blue-300 italic flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {args && Object.keys(args).length > 0 ? 'Executing API call...' : 'Preparing tool call...'}
              </p>
              {/* Show progress dots */}
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
