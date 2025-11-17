import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Beaker, Send, Loader2, AlertCircle } from 'lucide-react'
import { ChatMessage } from '@/components/ChatMessage'
import { useApiChat } from '@/hooks/useApiChat'
import { useMcpTools } from '@/hooks/useMcpTools'
import { useRef, useEffect } from 'react'

function App() {
  const { messages, input, isLoading, error, handleInputChange, handleSubmit } = useApiChat()
  const { isStarting, isReady, error: mcpError } = useMcpTools()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showError = error || mcpError

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Beaker className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">APILab</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Status indicator */}
            <div className="flex items-center gap-2 text-sm">
              {isStarting && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                  <span className="text-muted-foreground">Starting...</span>
                </>
              )}
              {isReady && (
                <>
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Ready</span>
                </>
              )}
            </div>
            <Button variant="ghost" size="sm">
              Docs
            </Button>
            <Button variant="ghost" size="sm">
              Settings
            </Button>
            <Button variant="outline" size="sm">
              Share
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Welcome Card - Show only when no messages */}
          {messages.length === 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Welcome to APILab 🧪</CardTitle>
                <CardDescription>
                  Test any API in your browser with plain English. No Postman, no curl, no installation needed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">🌐 Zero Setup</h3>
                    <p className="text-sm text-muted-foreground">
                      Runs entirely in your browser. No installation required.
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">🔌 Webhook Testing</h3>
                    <p className="text-sm text-muted-foreground">
                      Get temporary webhook endpoints powered by E2B sandboxes.
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">💻 Code Generation</h3>
                    <p className="text-sm text-muted-foreground">
                      Auto-generate curl, Python, JavaScript code snippets.
                    </p>
                  </div>
                </div>

                {/* Example prompts */}
                <div className="mt-6 space-y-2">
                  <p className="text-sm font-medium">Try asking:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Get the latest Bitcoin price',
                      'Test the JSONPlaceholder API',
                      'Make a GET request to api.github.com/zen',
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
                      >
                        "{example}"
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chat Interface */}
          <Card>
            <CardHeader>
              <CardTitle>API Testing Chat</CardTitle>
              <CardDescription>
                Ask me to test any API, and I'll make the request for you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Error Display */}
              {showError && (
                <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">Error</p>
                    <p className="text-sm text-destructive/90">
                      {showError.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Messages Area */}
              <div className="min-h-[400px] max-h-[600px] mb-4 p-4 border rounded-lg overflow-y-auto space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>Start by typing an API test request below...</p>
                  </div>
                ) : (
                  <>
                    {messages.map((message, index) => (
                      <ChatMessage
                        key={index}
                        role={message.role}
                        content={message.content}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input Area */}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder={
                    isReady
                      ? "Type your API test request..."
                      : "Waiting for MCP server to start..."
                  }
                  disabled={isLoading || !isReady}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={isLoading || !isReady || !input.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Powered by E2B Sandboxes • MCP Servers • Groq AI
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
