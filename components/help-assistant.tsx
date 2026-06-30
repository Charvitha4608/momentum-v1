"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { Sparkles, Loader2, BookOpen } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { askHelpAssistant, type HelpAnswer } from "@/app/actions/help"
import { cn } from "@/lib/utils"

const EXAMPLES = [
  "What does carry-over mean?",
  "How is the calendar colored?",
  "Ahead vs on-time vs late?",
  "How do streaks work?",
]

export function HelpAssistant({ doc }: { doc: string }) {
  const [question, setQuestion] = useState("")
  const [result, setResult] = useState<HelpAnswer | null>(null)
  const [busy, startTransition] = useTransition()

  function ask(q: string) {
    const trimmed = q.trim()
    if (!trimmed || busy) return
    setQuestion(trimmed)
    startTransition(async () => {
      setResult(await askHelpAssistant(trimmed))
    })
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    ask(question)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ask box */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about how Momentum works…"
              aria-label="Ask the help assistant"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            <button
              type="submit"
              disabled={!question.trim() || busy}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Ask"}
            </button>
          </form>

          {/* Example prompts */}
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => ask(ex)}
                disabled={busy}
                className="rounded-full border border-line px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-line-2 hover:text-foreground disabled:opacity-40"
              >
                {ex}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Answer / fallback */}
      {result && (
        <Card>
          <CardContent>
            {result.ok ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{result.answer}</div>
            ) : (
              <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <BookOpen className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <span>{result.message}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Always-available full guide */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BookOpen className="size-4" />
          The full guide
        </div>
        <Card>
          <CardContent>
            <MarkdownLite source={doc} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// A tiny, dependency-free renderer for the subset of Markdown the guide uses:
// `#`/`##`/`###` headings, `- ` bullets, `> ` callouts, and paragraphs. Inline
// `**bold**` markers are stripped to plain text. Good enough to make the guide
// readable on the page without pulling in a full Markdown library.
function MarkdownLite({ source }: { source: string }) {
  const lines = source.split("\n")
  const blocks: React.ReactNode[] = []
  let list: string[] = []
  let key = 0

  const flushList = () => {
    if (list.length === 0) return
    blocks.push(
      <ul key={key++} className="my-2 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
        {list.map((item, i) => (
          <li key={i}>{strip(item)}</li>
        ))}
      </ul>
    )
    list = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.startsWith("- ")) {
      list.push(line.slice(2))
      continue
    }
    flushList()
    if (!line.trim()) continue
    if (line.startsWith("### ")) {
      blocks.push(<h4 key={key++} className="mt-4 text-sm font-semibold text-foreground">{strip(line.slice(4))}</h4>)
    } else if (line.startsWith("## ")) {
      blocks.push(<h3 key={key++} className="mt-5 text-base font-semibold text-foreground">{strip(line.slice(3))}</h3>)
    } else if (line.startsWith("# ")) {
      blocks.push(<h2 key={key++} className="mt-2 text-lg font-semibold text-foreground">{strip(line.slice(2))}</h2>)
    } else if (line.startsWith("> ")) {
      blocks.push(
        <p key={key++} className="my-2 border-l-2 border-line pl-3 text-sm italic text-muted-foreground">{strip(line.slice(2))}</p>
      )
    } else {
      blocks.push(<p key={key++} className="my-2 text-sm leading-relaxed text-muted-foreground">{strip(line)}</p>)
    }
  }
  flushList()

  return <div className="max-h-[70vh] overflow-y-auto pr-1">{blocks}</div>
}

/** Strip the markdown emphasis markers we don't render inline. */
function strip(text: string): string {
  return text.replace(/\*\*/g, "")
}
