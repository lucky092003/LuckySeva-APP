import { FormEvent, useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";
import { useApp } from "@/context/app-context";
import { ApiError, api } from "@/services/api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
};

const CUSTOMER_PROMPTS = [
  "Which service should I book for a leaking tap?",
  "How does live booking tracking work?",
  "How do I reschedule a booking?",
];
const PROVIDER_PROMPTS = [
  "How do I start a customer journey?",
  "When should I share my live location?",
  "How do I manage incoming requests?",
];

const createMessage = (
  role: ChatMessage["role"],
  content: string,
  failed = false,
): ChatMessage => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  role,
  content,
  failed,
});

export const AssistantScreen = () => {
  const { role, back } = useApp();
  const isProvider = role === "provider";
  const prompts = isProvider ? PROVIDER_PROMPTS : CUSTOMER_PROMPTS;
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      "assistant",
      isProvider
        ? "Hi! I’m Lucky, your Partner assistant. Ask me about requests, job steps, location sharing, or using the app."
        : "Hi! I’m Lucky, your home-services assistant. Ask me about choosing a service, bookings, tracking, or using the app.",
    ),
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const recordingTimer = useRef<number | null>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(
    () => () => {
      if (recordingTimer.current != null)
        window.clearTimeout(recordingTimer.current);
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      window.speechSynthesis?.cancel();
    },
    [],
  );

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;

    const outgoing = createMessage("user", content);
    const history = [...messages, outgoing];
    setMessages(history);
    setDraft("");
    setVoiceError("");
    setSending(true);
    try {
      const response = await api.assistant.chat(
        history
          .slice(-16)
          .map(({ role: messageRole, content: messageContent }) => ({
            role: messageRole,
            content: messageContent,
          })),
      );
      setMessages((current) => [
        ...current,
        createMessage("assistant", response.reply),
      ]);
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 404
          ? "The AI assistant is not deployed on this backend yet. Deploy the chatbot backend update, then try again."
          : error instanceof Error
            ? error.message
            : "Lucky could not reply right now. Please try again.";
      setMessages((current) => [
        ...current,
        createMessage("assistant", message, true),
      ]);
    } finally {
      setSending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(draft);
  };

  const transcribeAudio = async (audio: Blob) => {
    if (!audio.size) {
      setVoiceError("The voice recording was empty. Please try again.");
      return;
    }
    setTranscribing(true);
    setVoiceError("");
    try {
      const result = await api.assistant.transcribe(audio);
      setDraft((current) =>
        current ? `${current} ${result.text}` : result.text,
      );
    } catch (error) {
      setVoiceError(
        error instanceof ApiError && error.status === 404
          ? "Voice assistant is not deployed on this backend yet. Deploy the chatbot backend update, then try again."
          : error instanceof Error
            ? error.message
            : "Could not transcribe your voice. Please try again.",
      );
    } finally {
      setTranscribing(false);
    }
  };

  const startAudioRecording = async () => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setVoiceError(
        "Voice input is not supported here. You can still type your message.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const nextRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      audioChunks.current = [];
      mediaStream.current = stream;
      recorder.current = nextRecorder;
      nextRecorder.ondataavailable = (event) => {
        if (event.data.size) audioChunks.current.push(event.data);
      };
      nextRecorder.onerror = () => {
        setVoiceError(
          "Voice recording failed. Please try again or type your message.",
        );
        setListening(false);
        stream.getTracks().forEach((track) => track.stop());
        mediaStream.current = null;
      };
      nextRecorder.onstop = () => {
        setListening(false);
        if (recordingTimer.current != null)
          window.clearTimeout(recordingTimer.current);
        recordingTimer.current = null;
        stream.getTracks().forEach((track) => track.stop());
        mediaStream.current = null;
        const audio = new Blob(audioChunks.current, {
          type: nextRecorder.mimeType || "audio/webm",
        });
        audioChunks.current = [];
        void transcribeAudio(audio);
      };
      setListening(true);
      nextRecorder.start();
      recordingTimer.current = window.setTimeout(() => {
        setVoiceError(
          "Voice recording reached the 60-second limit and is being transcribed.",
        );
        if (nextRecorder.state === "recording") nextRecorder.stop();
      }, 60_000);
    } catch (error) {
      setListening(false);
      setVoiceError(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access and try again."
          : "Could not start voice recording. Please try again.",
      );
    }
  };

  const toggleVoiceInput = () => {
    if (listening) {
      if (recorder.current?.state === "recording") recorder.current.stop();
      return;
    }
    void startAudioRecording();
  };

  const speak = (text: string) => {
    if (!window.speechSynthesis) {
      setVoiceError("Voice playback is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = navigator.language || "en-IN";
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex h-full flex-col bg-[#f5f6fa] dark:bg-gray-950">

      {/* ── Gradient Header ── */}
      <div
        className="relative shrink-0 px-4 pb-7 pt-4"
        style={{ background: "linear-gradient(135deg,#059669 0%,#047857 100%)" }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={back}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30 active:scale-95"
          >
            <Icons.X size={16} />
          </button>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <Icons.Sparkles size={18} className="text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold leading-tight tracking-tight">
              <span className="text-black dark:text-gray-100">Lucky</span><span className="text-orange-500">Seva</span>{' '}
              <span className="text-emerald-200">AI</span>
            </h1>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-300"
                style={{ animation: sending ? "none" : "ls-pulse 2s ease-in-out infinite" }}
              />
              <p className="text-[11px] font-medium text-emerald-100">
                {sending ? "Typing…" : "Online · Here to help"}
              </p>
            </div>
          </div>
        </div>

        {/* Wave cutout */}
        <svg
          viewBox="0 0 400 20"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 right-0 w-full"
          style={{ height: 20, display: "block" }}
        >
          <path className="fill-[#f5f6fa] dark:fill-gray-950" d="M0,0 C100,20 300,20 400,0 L400,20 L0,20 Z" />
        </svg>

        <style>{`@keyframes ls-pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>

      {/* ── Messages ── */}
      <section className="no-scrollbar flex-1 overflow-y-auto px-4 pb-3 pt-5">

        {/* Welcome bubble */}
        <div className="mb-4 flex items-end gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600"
            style={{ boxShadow: "0 2px 8px rgba(5,150,105,.35)" }}
          >
            <Icons.Sparkles size={13} className="text-white" />
          </div>
          <div className="max-w-[80%]">
            <div
              className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm leading-relaxed text-gray-800 dark:bg-gray-800 dark:text-gray-100"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,.08)" }}
            >
              {messages[0].content}
            </div>
            <p className="ml-1 mt-1 text-[10px] text-gray-400">
              <span className="text-black dark:text-gray-100">Lucky</span><span className="text-orange-500">Seva</span> · now
            </p>
          </div>
        </div>

        {/* Suggested chips */}
        {messages.length === 1 && (
          <div className="mb-3 space-y-2">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Suggested
            </p>
            {prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => void sendMessage(prompt)}
                disabled={sending}
                className="group flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left text-[13px] font-medium text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50 active:scale-[.98] dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}
              >
                <Icons.MessageCircle size={14} className="shrink-0 text-emerald-500 group-hover:text-emerald-700" />
                <span className="flex-1 leading-snug">{prompt}</span>
                <Icons.ChevronRight size={13} className="shrink-0 text-gray-300 group-hover:text-emerald-400" />
              </button>
            ))}
          </div>
        )}

        {/* Conversation */}
        {messages.length > 1 && (
          <div className="space-y-3">
            {messages.slice(1).map((message) => (
              <article
                key={message.id}
                className={`flex items-end gap-2 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {message.role === "assistant" && (
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600"
                    style={{ boxShadow: "0 2px 8px rgba(5,150,105,.35)" }}
                  >
                    <Icons.Sparkles size={12} className="text-white" />
                  </div>
                )}

                <div className={`flex max-w-[76%] flex-col gap-1 ${message.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "rounded-br-sm text-white"
                        : message.failed
                          ? "rounded-bl-sm bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                          : "rounded-bl-sm bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                    }`}
                    style={
                      message.role === "user"
                        ? { background: "linear-gradient(135deg,#059669 0%,#047857 100%)", boxShadow: "0 4px 14px rgba(5,150,105,.35)" }
                        : { boxShadow: "0 2px 12px rgba(0,0,0,.08)" }
                    }
                  >
                    {message.failed && (
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                        <Icons.AlertCircle size={12} />
                        <span>Could not deliver</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.role === "assistant" && !message.failed && (
                      <button
                        onClick={() => speak(message.content)}
                        aria-label="Read aloud"
                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 transition hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        <Icons.Volume2 size={11} /> Listen
                      </button>
                    )}
                  </div>
                  <p className="px-1 text-[10px] text-gray-400 dark:text-gray-500">
                    {message.role === "user" ? "You" : (
                      <>
                        <span className="text-black dark:text-gray-100">Lucky</span><span className="text-orange-500">Seva</span>
                      </>
                    )} · now
                  </p>
                </div>
              </article>
            ))}

            {/* Typing dots */}
            {sending && (
              <div className="flex items-end gap-2">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600"
                  style={{ boxShadow: "0 2px 8px rgba(5,150,105,.35)" }}
                >
                  <Icons.Sparkles size={12} className="text-white" />
                </div>
                <div
                  className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-white px-4 py-3 dark:bg-gray-800"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,.08)" }}
                >
                  <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-duration:1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:150ms] [animation-duration:1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:300ms] [animation-duration:1s]" />
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEnd} className="h-3" />
      </section>

      {/* ── Input Footer ── */}
      <div className="shrink-0 bg-white px-4 pb-5 pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.07)] dark:bg-gray-900 dark:shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
        {voiceError && (
          <div className="mb-2.5 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
            <Icons.AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">{voiceError}</p>
          </div>
        )}

        <form onSubmit={submit} className="flex items-end gap-2">
          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={transcribing}
            aria-label={transcribing ? "Transcribing" : listening ? "Stop recording" : "Voice input"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition disabled:opacity-50 ${
              listening
                ? "bg-red-100 text-red-500 dark:bg-red-950/40"
                : "bg-gray-100 text-gray-500 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {transcribing ? (
              <Icons.LoaderCircle size={16} className="animate-spin" />
            ) : listening ? (
              <Icons.MicOff size={16} />
            ) : (
              <Icons.Mic size={16} />
            )}
          </button>

          <div className="relative flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(draft);
                }
              }}
              maxLength={2000}
              rows={1}
              placeholder={
                transcribing ? "Transcribing…" : listening ? "Listening… tap to stop" : "Type a message…"
              }
              aria-label="Message LuckySeva"
              className="max-h-28 min-h-10 w-full resize-none rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:bg-gray-50 focus:ring-2 focus:ring-emerald-400/40 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            {listening && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-bold text-red-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                REC
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#059669 0%,#047857 100%)", boxShadow: "0 4px 12px rgba(5,150,105,.4)" }}
          >
            {sending ? (
              <Icons.LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Icons.Send size={15} />
            )}
          </button>
        </form>

        <p className="mt-2 text-center text-[10px] text-gray-400 dark:text-gray-500">
          Never share OTPs or passwords · Powered by{' '}
          <span className="text-black dark:text-gray-100">Lucky</span><span className="text-orange-500">Seva</span> AI
        </p>
      </div>
    </div>
  );
};
