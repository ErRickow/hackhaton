/**
 * Settings Component
 * Configure API keys and preferences
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings as SettingsIcon, Eye, EyeOff, Check, X } from 'lucide-react';
import { useApiKeys } from '@/hooks/useLocalStorage';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const { apiKeys, updateKey, hasE2bKey, hasLLMKey } = useApiKeys();
  const [showKeys, setShowKeys] = useState(false);
  const [tempKeys, setTempKeys] = useState(apiKeys);

  if (!isOpen) return null;

  const handleSave = () => {
    updateKey('e2b', tempKeys.e2b);
    updateKey('neosantara', tempKeys.neosantara);
    updateKey('groq', tempKeys.groq);
    onClose();
  };

  const handleCancel = () => {
    setTempKeys(apiKeys);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              <CardTitle>Settings</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Configure your API keys. All keys are stored locally in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* E2B API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                E2B API Key <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2">
                {hasE2bKey ? (
                  <Badge variant="default" className="bg-green-500">
                    <Check className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-yellow-600">
                    Required
                  </Badge>
                )}
              </div>
            </div>
            <Input
              type={showKeys ? 'text' : 'password'}
              value={tempKeys.e2b}
              onChange={(e) => setTempKeys({ ...tempKeys, e2b: e.target.value })}
              placeholder="e2b_..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Get your key from:{' '}
              <a
                href="https://e2b.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                https://e2b.dev
              </a>
            </p>
          </div>

          {/* Neosantara AI Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Neosantara AI API Key (Primary LLM)
              </label>
              <div className="flex items-center gap-2">
                {tempKeys.neosantara ? (
                  <Badge variant="default" className="bg-green-500">
                    <Check className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="outline">Optional</Badge>
                )}
              </div>
            </div>
            <Input
              type={showKeys ? 'text' : 'password'}
              value={tempKeys.neosantara}
              onChange={(e) => setTempKeys({ ...tempKeys, neosantara: e.target.value })}
              placeholder="nsk_..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Indonesian language model with function calling support
              <br />
              Get your key from:{' '}
              <a
                href="https://api.neosantara.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                https://api.neosantara.xyz
              </a>
            </p>
          </div>

          {/* Groq API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Groq API Key (Alternative LLM)
              </label>
              <div className="flex items-center gap-2">
                {tempKeys.groq ? (
                  <Badge variant="default" className="bg-green-500">
                    <Check className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="outline">Optional</Badge>
                )}
              </div>
            </div>
            <Input
              type={showKeys ? 'text' : 'password'}
              value={tempKeys.groq}
              onChange={(e) => setTempKeys({ ...tempKeys, groq: e.target.value })}
              placeholder="gsk_..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Fast inference with llama-3.1-8b-instant
              <br />
              Get your key from:{' '}
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                https://console.groq.com
              </a>
            </p>
          </div>

          {/* Show/Hide Keys Toggle */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKeys(!showKeys)}
            >
              {showKeys ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide Keys
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show Keys
                </>
              )}
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!tempKeys.e2b || (!tempKeys.neosantara && !tempKeys.groq)}>
                Save Changes
              </Button>
            </div>
          </div>

          {/* Warning */}
          {(!hasE2bKey || !hasLLMKey) && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ <strong>Required:</strong> You need at least E2B API key and one LLM provider (Neosantara or Groq) to use APILab.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
