"use client";
import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function TagInput({ tags, onChange, placeholder = "Agregar etiqueta..." }: TagInputProps) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const tag = input.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !tags.includes(tag) && tags.length < 8) {
      onChange([...tags, tag]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => onChange(tags.filter(t => t !== tag));

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
    if (e.key === "Backspace" && !input && tags.length) removeTag(tags[tags.length - 1]);
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center bg-surface border border-surface-border rounded-lg px-3 py-2 focus-within:border-primary/50 transition-colors">
      {tags.map(tag => (
        <span key={tag}
          className="flex items-center gap-1 text-xs bg-primary/15 text-primary-light border border-primary/20 px-2 py-0.5 rounded-full">
          #{tag}
          <button onClick={() => removeTag(tag)} className="hover:text-danger transition-colors">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={addTag}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none min-w-[80px]"
      />
    </div>
  );
}
