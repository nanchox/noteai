"use client";
import { useEffect, useState, useRef } from "react";
import { chatApi } from "@/lib/api";
import { Send, Trash2, Sparkles, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import clsx from "clsx";

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatApi.history().then(h => {
      setMessages(h);
      setHistoryLoading(false);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg = { role: "user", content: text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { reply } = await chatApi.send(text);
      const aiMsg = { role: "assistant", content: reply, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Tuve un problema para responder. Intenta de nuevo.",
        created_at: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearHistory = async () => {
    if (!confirm("¿Borrar historial del chat?")) return;
    await chatApi.clearHistory();
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-light" />
          <span className="font-semibold text-white text-sm">Asistente NoteAI</span>
          <span className="text-xs text-gray-500">· con Claude</span>
        </div>
        <button onClick={clearHistory} className="p-1.5 text-gray-500 hover:text-danger rounded-lg transition-colors" title="Borrar historial">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {historyLoading && (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!historyLoading && messages.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <Sparkles className="w-10 h-10 text-primary/30 mx-auto" />
            <p className="text-sm text-gray-400">¡Hola! Soy tu asistente IA.</p>
            <p className="text-xs text-gray-500">Puedo ayudarte con tus notas, tareas y proyectos.</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {[
                "¿Qué tareas tengo pendientes?",
                "Resúmeme mis notas recientes",
                "¿Cuáles notas hablan de...?",
              ].map(s => (
                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-xs bg-surface-card border border-surface-border text-gray-300 px-3 py-2 rounded-xl hover:border-primary/30 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={clsx("flex gap-3 animate-slide-up", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-primary-light" />
              </div>
            )}
            <div className={clsx(
              "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
              msg.role === "user"
                ? "bg-primary text-white rounded-tr-sm"
                : "bg-surface-card border border-surface-border text-gray-200 rounded-tl-sm"
            )}>
              {msg.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-gray-300" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start animate-slide-up">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary-light" />
            </div>
            <div className="bg-surface-card border border-surface-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center h-4">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-surface-border">
        <div className="flex gap-2 items-end bg-surface-card border border-surface-border rounded-2xl px-4 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none resize-none max-h-32 py-1.5"
            style={{ minHeight: "36px" }}
          />
          <button onClick={send} disabled={!input.trim() || loading}
            className="w-8 h-8 bg-primary hover:bg-primary-dark rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 shrink-0 mb-0.5">
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        <p className="text-xs text-gray-600 text-center mt-1.5">Enter para enviar · Shift+Enter para nueva línea</p>
      </div>
    </div>
  );
}
