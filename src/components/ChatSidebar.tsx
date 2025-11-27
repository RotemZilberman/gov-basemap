import { FormEvent, useRef, useState } from "react";
import { McpRequest, sendMcpCommand } from "../mcp/client";

type Message = { role: "user" | "assistant" | "system"; text: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const ChatSidebar = ({ isOpen, onClose }: Props) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "היי! אני כאן כדי לעזור לך לצייר, לחפש או לשלוט בשכבות במפת GovMap.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;

    const payload: McpRequest = {
      command: "chat",
      args: { prompt: input.trim() },
    };

    setMessages((prev) => [...prev, { role: "user", text: input.trim() }]);
    setInput("");
    setBusy(true);
    try {
      const res = await sendMcpCommand(payload);
      const text = res.message ?? JSON.stringify(res.data ?? res.status);
      setMessages((prev) => [...prev, { role: "assistant", text }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: err instanceof Error ? err.message : "Request failed" },
      ]);
    } finally {
      setBusy(false);
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
    }
  };

  return (
    <aside className={`chat-panel-card side-panel-card ${isOpen ? "chat-panel-card--open side-panel-card--open" : ""}`}>
      <div className="side-panel">
        <div className="side-panel-header">
          <div className="chat-panel__brand">
            <img src="/logos/bot_logo.png" alt="ChatGPT" className="chat-panel__logo" />
            <div>
              <div className="chat-panel__title">GovMap Assistant</div>
              <div className="chat-panel__subtitle">שואל, עונה, ומפעיל את המפה</div>
            </div>
          </div>
          <button className="chat-panel__close" onClick={onClose} aria-label="סגירת צ'אט">
            ✕
          </button>
        </div>

        <div className="chat-panel__body" ref={scrollRef}>
          {messages.map((msg, idx) => (
            <div key={`${msg.role}-${idx}`} className={`chat-bubble chat-bubble--${msg.role}`}>
              {msg.text}
            </div>
          ))}
        </div>

        <form className="chat-panel__input-row" onSubmit={send}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="שאל אותי מה לצייר, איפה לחפש, או איזו שכבה להדליק…"
            disabled={busy}
          />
          <button type="submit" className="btn primary" disabled={busy || !input.trim()}>
            {busy ? "שולח..." : "שלח"}
          </button>
        </form>
      </div>
    </aside>
  );
};

export default ChatSidebar;
