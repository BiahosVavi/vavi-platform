"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, Send } from "lucide-react";
import { Markdown } from "@/components/brainstorm/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "What are the top 3 actions I should take this week based on my tasks and pipeline?",
  "Summarize my project's current status and flag any risks.",
  "Give me a concrete growth strategy for the next 30 days.",
];

interface ProjectChatProps {
  conversationId: string;
  initialMessages: UIMessage[];
  projectName: string;
}

export function ProjectChat({
  conversationId,
  initialMessages,
  projectName,
}: ProjectChatProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { conversationId },
    }),
    messages: initialMessages,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({ text });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] min-h-[400px]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-6 pt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Ask Vavi anything about <span className="font-medium text-foreground">{projectName}</span>.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-md">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setInput("");
                    sendMessage({ text: prompt });
                  }}
                  className="rounded-lg border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}

        {/* Streaming indicator when waiting for first chunk */}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
            <Loader2 className="size-3.5 animate-spin" />
            Vavi is thinking…
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive px-1">
            Error: {error.message}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t pt-3 flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
          rows={2}
          className="resize-none text-sm flex-1"
          disabled={isLoading}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        )}
      >
        {isUser ? (
          // User: render plain text parts
          <div className="text-sm whitespace-pre-wrap">
            {message.parts
              .filter((p) => p.type === "text")
              .map((p, i) => (
                <span key={i}>{p.text}</span>
              ))}
          </div>
        ) : (
          // Assistant: render markdown parts
          <div>
            {message.parts
              .filter((p) => p.type === "text")
              .map((p, i) => (
                <Markdown key={i} content={p.text} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
