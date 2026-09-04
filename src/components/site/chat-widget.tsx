"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string; products?: ProductRef[] };
type ProductRef = { name: string; slug: string; price: string; inStock: boolean };

/**
 * Floating AI shopping assistant. All model access happens on the server via
 * /api/chat — no API key is ever present in the browser.
 */
export function ChatWidget({ assistantName, greeting }: { assistantName: string; greeting: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: greeting }]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || pending) return;

    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: "user", content: question }]);
    setInput("");
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setError(json?.error ?? "The assistant is unavailable right now.");
        return;
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: json.data.reply, products: json.data.products },
      ]);
    } catch {
      setError("Could not reach the assistant. Please check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="no-print">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-primary fixed bottom-4 right-4 z-40 shadow-[var(--shadow-tm-lg)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" strokeLinejoin="round" />
          </svg>
          {/*
            No aria-label. The visible text below is already the accessible
            name, and an aria-label of "Open …" would replace it — leaving a
            voice-control user saying "click Ask Trust Assistant" with a button
            that does not answer to what it says (WCAG 2.5.3, Label in Name).
          */}
          Ask {assistantName}
        </button>
      ) : (
        <div className="fixed bottom-4 right-4 z-40 flex max-h-[min(80vh,34rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[var(--radius-tm-xl)] border border-line bg-white shadow-[var(--shadow-tm-lg)] animate-fade-up">
          <div className="row-between border-b border-line bg-brand-900 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-bold text-white">{assistantName}</p>
              <p className="text-[0.6875rem] text-brand-300">Product & policy questions</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-brand-300 hover:text-white" aria-label="Close assistant">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[85%] rounded-[var(--radius-tm)] bg-brand-900 px-3 py-2 text-sm text-white"
                      : "max-w-[90%] rounded-[var(--radius-tm)] bg-surface-muted px-3 py-2 text-sm text-brand-800"
                  }
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  {message.products && message.products.length > 0 ? (
                    <ul className="mt-2 space-y-1 border-t border-line pt-2">
                      {message.products.map((product) => (
                        <li key={product.slug}>
                          <Link href={`/product/${product.slug}`} className="link text-xs" onClick={() => setOpen(false)}>
                            {product.name} — {product.price}
                            {product.inStock ? "" : " (out of stock)"}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex items-center gap-2 text-xs text-brand-500">
                <span className="spinner" aria-hidden="true" /> Thinking…
              </div>
            ) : null}
            {error ? <p className="form-error">{error}</p> : null}
          </div>

          <form onSubmit={send} className="border-t border-line p-3">
            <div className="input-affix">
              <input
                className="input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about a product, price or delivery…"
                maxLength={1000}
                aria-label="Your question"
              />
              <button type="submit" className="input-affix-text font-semibold hover:bg-brand-100" disabled={pending}>
                Send
              </button>
            </div>
            <p className="form-hint mt-1.5">
              Answers come from published Trust Mart catalogue and policy data.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
