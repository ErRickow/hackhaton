/**
 * Groq Client
 * Direct client-side Groq API calls for quick prototyping
 */

import Groq from 'groq-sdk';

export function createGroqClient() {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('Groq API key not found. Please set VITE_GROQ_API_KEY in .env file.');
  }

  return new Groq({
    apiKey,
    dangerouslyAllowBrowser: true, // For dev only - move to backend in production!
  });
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
) {
  try {
    const groq = createGroqClient();

    const stream = await groq.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }

    onComplete();
    return fullResponse;
  } catch (error) {
    console.error('Groq streaming error:', error);
    onError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
