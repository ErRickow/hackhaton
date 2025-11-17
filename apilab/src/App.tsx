import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Flask, Send } from 'lucide-react'

function App() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flask className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">APILab</h1>
          </div>
          <div className="flex items-center gap-4">
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
          {/* Welcome Card */}
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
            </CardContent>
          </Card>

          {/* Chat Interface Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>API Testing Chat</CardTitle>
              <CardDescription>
                Try: "Get the latest Bitcoin price from CoinGecko" or "Test a webhook"
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Chat Messages Area */}
              <div className="min-h-[400px] mb-4 p-4 border rounded-lg bg-muted/20">
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Start by typing an API test request below...</p>
                </div>
              </div>

              {/* Input Area */}
              <div className="flex gap-2">
                <Input
                  placeholder="Type your API test request..."
                  className="flex-1"
                />
                <Button size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
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
