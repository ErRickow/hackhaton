/**
 * APILab - Minimalist Chat Interface
 * Inspired by modern chat UIs (ChatGPT, Claude, etc.)
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Loader2, Settings as SettingsIcon, AlertCircle } from 'lucide-react'
import { ChatMessage } from '@/components/ChatMessage'
import { ToolExecutionCard } from '@/components/ToolExecutionCard'
import { Settings } from '@/components/Settings'
import { useApiChat } from '@/hooks/useApiChat'
import { useMcpTools } from '@/hooks/useMcpTools'
import { useApiKeys } from '@/hooks/useLocalStorage'
import { useRef, useEffect, useState } from 'react'

function App() {
  const { messages, input, isLoading, error, toolExecutions, handleInputChange, handleSubmit } = useApiChat()
  const { isStarting, isReady, error: mcpError } = useMcpTools()
  const { isConfigured } = useApiKeys()
  const [showSettings, setShowSettings] = useState(!isConfigured)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showError = error || mcpError

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Minimal Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AL</span>
            </div>
            <h1 className="text-lg font-semibold">APILab</h1>
          </div>

          {/* Status Indicator (Minimal) */}
          {isStarting && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Starting...</span>
            </div>
          )}
          {isReady && (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Ready</span>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSettings(true)}
          className="h-9 w-9"
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </header>

      {/* Messages Area - Full Screen */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {/* Error Display */}
          {showError && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Error</p>
                <p className="text-xs text-destructive/90">{showError.message}</p>
              </div>
            </div>
          )}

          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-2">
                <span className="text-white font-bold text-2xl">AL</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-1">Welcome to APILab</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Test any API with plain English. Powered by E2B MCP servers.
                </p>
              </div>

              {/* Example Prompts */}
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {[
                  'Search for latest AI news',
                  'Find papers about machine learning',
                ].map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const event = new Event('submit') as any
                      event.preventDefault = () => {}
                      handleInputChange({
                        target: { value: example },
                      } as any)
                      setTimeout(() => handleSubmit(event), 100)
                    }}
                    className="text-xs"
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <ChatMessage
                  key={index}
                  role={message.role}
                  content={message.content}
                  isStreaming={isLoading && index === messages.length - 1}
                />
              ))}

              {/* Tool Executions */}
              {toolExecutions.length > 0 && (
                <div className="space-y-2">
                  {toolExecutions.map((execution) => (
                    <ToolExecutionCard
                      key={execution.id}
                      toolName={execution.toolName}
                      status={execution.status}
                      args={execution.args}
                      result={execution.result}
                      error={execution.error}
                      startTime={execution.startTime}
                      endTime={execution.endTime}
                    />
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area - Fixed Bottom */}
      <div className="border-t bg-background px-4 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder={
                isReady
                  ? "Ask me anything..."
                  : "Waiting for server..."
              }
              disabled={isLoading || !isReady}
              className="flex-1"
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !isReady || !input.trim()}
              className="h-10 w-10"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Powered by E2B Sandboxes • MCP Servers
          </p>
        </div>
      </div>

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}

export default App
