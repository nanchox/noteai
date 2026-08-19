"use client";
import { useEffect, useState, useRef } from "react";
import { chatApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Send, Trash2, Sparkles, User, FileText, CheckSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import clsx from "clsx";

const SUGGESTIONS = [
  "¿Qué tareas tengo pendientes?",
  "Crea una nota sobre mis ideas de hoy",
  "Agrega una tarea urgente para mañana",
  "Resúmeme mis notas recientes",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    chatApi.history().then(h => {
      setMessages(h);
      setHistoryLoading(false);
    });
  }, [ready]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg = { role: "user", content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { reply, actions } = await chatApi.send(msg) as any;
      const aiMsg = {
        role: "assistant",
        content: reply,
        actions: actions || [],
        created_at: new Date().toISOString()
      };
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
          <span className="text-xs text-gray-500 hidden md:inline">· Puedo crear notas y tareas por ti</span>
        </div>
        <button onClick={clearHistory}
          className="p-1.5 text-gray-500 hover:text-danger rounded-lg transition-colors">
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
          <div className="text-center py-10 space-y-4">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto border border-primary/20">
              <Sparkles className="w-7 h-7 text-primary-light" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">¡Hola! Soy tu asistente IA.</p>
              <p className="text-xs text-gray-500 mt-1">Pregúntame cualquier cosa sobre tus notas y tareas,<br />o pídeme que cree algo por ti.</p>
            </div>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs bg-surface-card border border-surface-border text-gray-300 px-3 py-2.5 rounded-xl hover:border-primary/30 hover:text-white transition-colors text-left">
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
            <div className="max-w-[82%] space-y-2">
              <div className={clsx(
                "rounded-2xl px-4 py-3 text-sm",
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

              {/* Acciones realizadas */}
              {msg.actions?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {msg.actions.map((a: any, j: number) => (
                    <div key={j}
                      className="flex items-center gap-1.5 text-xs bg-success/10 border border-success/20 text-success px-2.5 py-1 rounded-full">
                      {a.created === "note"
                        ? <FileText className="w-3 h-3" />
                        : <CheckSquare className="w-3 h-3" />}
                      {a.created === "note" ? "Nota creada:" : "Tarea creada:"} {a.title}
                    </div>
                  ))}
                </div>
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
        <div className="flex gap-2 items-end bg-surface-card border border-surface-border rounded-2xl px-4 py-2 focus-within:border-primary/40 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribe o pide que cree algo..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none resize-none max-h-32 py-1.5"
            style={{ minHeight: "36px" }}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="w-8 h-8 bg-primary hover:bg-primary-dark rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 shrink-0 mb-0.5">
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        <p className="text-xs text-gray-600 text-center mt-1.5">Enter para enviar · Shift+Enter para nueva línea</p>
      </div>
    </div>
  );
}
