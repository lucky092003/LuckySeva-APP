import { FormEvent, useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";
import { useApp } from "@/context/app-context";
import { api, ApiError } from "@/services/api";

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
  const { role, navigate } = useApp();
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
    <div className="fixed inset-0 z-[60] flex items-center justify-end bg-black/40 backdrop-blur-sm sm:backdrop-blur-md" onClick={() => navigate({ name: "home" })}>
      <div
        className="fixed inset-y-0 right-0 z-[61] w-full max-w-xs sm:max-w-md bg-white dark:bg-gray-950 shadow-2xl shadow-emerald-900/20 transform transition-transform duration-300 translate-x-0 sm:translate-x-0 flex flex-col border-l border-gray-100 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3">
          <button
            onClick={() => navigate({ name: "home" })}
            aria-label="Close assistant"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition"
          >
            <Icons.X size={16} />
          </button>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white">
            <Icons.Sparkles size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-slate-900 dark:text-gray-100">AI Assistant</h1>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-gray-400">
              {isProvider ? "Partner support" : "Help with services and bookings"}
            </p>
          </div>
        </div>

        {/* Messages */}
        <section className="no-scrollbar flex min-h-[200px] flex-1 flex-col overflow-y-auto bg-[#f8fafc] dark:bg-gray-950 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              <Icons.Sparkles size={14} />
            </span>
            <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed">
              Hi! I’m Lucky, your home-services assistant. Ask me about choosing a service, booking a visit, tracking a job, or anything else about the app.
            </p>
          </div>

          {messages.length === 1 && (
            <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void sendMessage(prompt)}
                  disabled={sending}
                  className="group flex min-h-10 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/70 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/50"
                >
                  <span>{prompt}</span>
                  <Icons.ArrowUpRight size={13} className="shrink-0 text-slate-400 transition group-hover:text-emerald-700" />
                </button>
              ))}
            </div>
          )}

          {messages.length > 1 && (
            <div className="mt-6 space-y-4 sm:space-y-5">
              {messages.slice(1).map((message) => (
                <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] sm:max-w-[82%] ${message.role === "assistant" ? "flex items-start gap-2" : ""}`}>
                    {message.role === "assistant" && (
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <Icons.Sparkles size={13} />
                      </span>
                    )}
                    <div className={`min-w-0 rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "rounded-br-md bg-emerald-700 text-white" : message.failed ? "rounded-tl-md border border-amber-200 bg-amber-50 text-amber-900" : "rounded-tl-md bg-white border border-slate-200 text-slate-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"}`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.role === "assistant" && !message.failed && (
                        <button onClick={() => speak(message.content)} aria-label="Read response aloud" className="mt-2 inline-flex items-center gap-1 rounded-lg py-0.5 text-[10px] font-semibold text-slate-400 transition hover:text-emerald-700 dark:hover:text-emerald-400">
                          <Icons.Volume2 size={12} /> Listen
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Icons.Sparkles size={13} /></span>
                  <span className="inline-flex items-center gap-0.5 rounded-lg bg-white px-3 py-1.5 dark:bg-gray-800 shadow-sm">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:240ms]" />
                    <span className="ml-0.5">Lucky is thinking</span>
                  </span>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>
          )}
        </section>

        {/* Input */}
        <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 sm:p-4">
          {voiceError && (
            <p role="status" className="mb-2 px-1 text-[10px] text-amber-700">
              {voiceError}
            </p>
          )}
          <form onSubmit={submit} className="flex items-end gap-1.5">
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={transcribing}
              aria-label={
                transcribing
                  ? "Transcribing voice input"
                  : listening
                    ? "Stop voice input"
                    : "Start voice input"
              }
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-50 ${listening ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-gray-800 dark:text-gray-300"}`}
            >
              {transcribing ? (
                <Icons.LoaderCircle size={16} className="animate-spin" />
              ) : listening ? (
                <Icons.Square size={15} />
              ) : (
                <Icons.Mic size={17} />
              )}
            </button>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(draft);
                }
              }}
              maxLength={2000}
              rows={1}
              placeholder={
                transcribing
                  ? "Transcribing voice note…"
                  : listening
                    ? "Listening…"
                    : "Ask about services, bookings, tracking, or the app…"
              }
              aria-label="Message Lucky"
              className="max-h-32 min-h-10 min-w-0 flex-1 resize-y rounded-lg border border-transparent bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-800"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? (
                <Icons.LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Icons.Send size={16} />
              )}
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-slate-500 dark:text-gray-400">
            Don’t share OTPs, passwords, or payment PINs.
          </p>
        </div>
      </div>
    </div>
  );
};
