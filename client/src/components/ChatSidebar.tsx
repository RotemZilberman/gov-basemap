import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon } from "./Icons";
import {
  executeGovmapCommands,
  sendChatRequest,
  type ChatMessage,
  type ChatResponse
} from "../lib/chatClient";
import type { LayerOption } from "../config/layers";
import { ensureMagicToken, applyNewMagic, setLayerMetadata } from "../lib/sessionManager";
import { toLayerMetadataPayload } from "../lib/layerMetadata";

type Message = { role: "user" | "assistant" | "system"; text: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  mapDivId: string;
  mapReady?: boolean;
  layers: LayerOption[];
};

const ChatSidebar = ({ isOpen, onClose, mapDivId, mapReady = true, layers }: Props) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
  text: "היי! אני כאן כדי לעזור לך לצייר, לחפש או לשלוט בשכבות במפת GovMap."
    }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [magic, setMagic] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const MAX_TOOL_ROUNDS = 5; // Allow up to five tool-result exchanges with the server

  const layerMetadata = useMemo(() => toLayerMetadataPayload(layers), [layers]);

  useEffect(() => {
    setLayerMetadata(layerMetadata);
    (async () => {
      try {
        const token = await ensureMagicToken(layerMetadata);
        setMagic(token);
      } catch (err) {
        // Keep UI usable; errors will be surfaced on send.
      }
    })();
  }, [layerMetadata]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const appendAssistant = (msg?: ChatMessage | null) => {
    if (!msg?.content) return;
    setMessages((prev) => [...prev, { role: "assistant", text: msg.content }]);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim() || busy) return;
    if (!mapReady) {
      setMessages((prev) => [...prev, { role: "assistant", text: "המפה עדיין נטענת, נסה שוב בעוד רגע." }]);
      return;
    }

    const userText = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setInput("");
    setBusy(true);

    try {
      const activeMagic = magic ?? (await ensureMagicToken(layerMetadata));
      setMagic(activeMagic);

      let currentMagic = activeMagic;
      const applyMagicFromResponse = (res: ChatResponse) => {
        if (res.newMagic) {
          applyNewMagic(res.newMagic);
          setMagic(res.newMagic);
          currentMagic = res.newMagic;
        }
      };

      let response = await sendChatRequest({
        message: userText,
        magic: currentMagic,
        layerMetadata
      });

      applyMagicFromResponse(response);

      let finalAssistant: ChatMessage | undefined = response.assistantMessage ?? undefined;
      let toolRound = 0;

      while (toolRound < MAX_TOOL_ROUNDS) {
        const commands = response.govmapCommands ?? [];
        if (commands.length === 0) break;

        const toolResults = await executeGovmapCommands(commands, mapDivId);
        if (toolResults.length === 0) break;

        toolRound += 1;

        response = await sendChatRequest({
          message: "",
          toolResults,
          magic: currentMagic,
          layerMetadata
        });

        applyMagicFromResponse(response);

        if (response.assistantMessage) {
          finalAssistant = response.assistantMessage;
        }
      }

      appendAssistant(finalAssistant ?? null);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Request failed";
      setMessages((prev) => [...prev, { role: "assistant", text }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      className={`chat-panel-card side-panel-card ${
        isOpen ? "chat-panel-card--open side-panel-card--open" : ""
      }`}
    >
      <div className="side-panel">
        <div className="side-panel-header">
          <div className="chat-panel__brand">
            <img src="/logos/bot_logo.png" alt="ChatGPT" className="chat-panel__logo" />
            <div>
              <div className="chat-panel__title">GovMap Assistant</div>
              <div className="chat-panel__subtitle">שואל, עונה, ומפעיל את המפה</div>
            </div>
          </div>
          <button className="icon-btn chat-panel__close" onClick={onClose} aria-label="סגירת צ'אט">
            <CloseIcon />
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
