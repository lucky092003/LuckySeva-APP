import { FormEvent, useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";
import { useApp } from "@/context/app-context";
import { TopBar } from "@/components/PhoneShell";
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
  const { role } = useApp();
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f5f8f6] dark:bg-gray-950">
      <TopBar title="Lucky Assistant" />
      <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-3 pb-3 sm:px-5 lg:px-6 lg:py-5">
        <header className="mb-3 flex shrink-0 items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:mb-4 sm:px-5 sm:py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm shadow-emerald-900/15">
            <Icons.Sparkles size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-gray-100 sm:text-base">Ask Lucky</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Here to help
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-gray-400">
              {isProvider ? "Partner help, whenever you need it" : "Help with services, bookings, and the app"}
            </p>
          </div>
          <span className="hidden text-[10px] text-slate-400 sm:block">English / Hindi / Hinglish</span>
        </header>

        <section className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:px-6 sm:py-6">
          {messages.length === 1 && (
            <div className="mx-auto mb-6 w-full max-w-xl py-3 text-center sm:mb-8 sm:py-8">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Icons.MessageCircle size={26} />
              </span>
              <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-900 dark:text-gray-100 sm:text-xl">What can I help you with?</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-slate-500 dark:text-gray-400">Ask a question or choose a suggestion to get started.</p>
              <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void sendMessage(prompt)}
                    disabled={sending}
                    className="group flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left text-xs font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/70 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/50"
                  >
                    <span>{prompt}</span>
                    <Icons.ArrowUpRight size={14} className="shrink-0 text-slate-400 transition group-hover:text-emerald-700" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.length > 1 && (
            <div className="space-y-5 sm:space-y-6">
              {messages.slice(1).map((message) => (
                <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] sm:max-w-[78%] ${message.role === "assistant" ? "flex items-start gap-2.5" : ""}`}>
                    {message.role === "assistant" && (
                      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        <Icons.Sparkles size={14} />
                      </span>
                    )}
                    <div className={`min-w-0 rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "rounded-br-md bg-emerald-700 text-white" : message.failed ? "rounded-tl-md border border-amber-200 bg-amber-50 text-amber-900" : "rounded-tl-md bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-gray-200"}`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.role === "assistant" && !message.failed && (
                        <button onClick={() => speak(message.content)} aria-label="Read response aloud" className="mt-2 inline-flex items-center gap-1.5 rounded-lg py-1 text-[10px] font-semibold text-slate-400 transition hover:text-emerald-700 dark:hover:text-emerald-400">
                          <Icons.Volume2 size={13} /> Listen
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
              {sending && (
                <div className="flex items-center gap-2.5 text-xs text-slate-400">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Icons.Sparkles size={14} /></span>
                  <span className="inline-flex items-center gap-1 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-gray-800">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:240ms]" />
                    <span className="ml-1">Lucky is thinking</span>
                  </span>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>
          )}
        </section>

        <div className="mt-3 shrink-0 rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-3">
            {voiceError && (
              <p role="status" className="mb-2 px-2 text-xs text-amber-700">
                {voiceError}
              </p>
            )}
            <form onSubmit={submit} className="flex items-end gap-2">
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
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-50 ${listening ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-gray-800 dark:text-gray-300"}`}
              >
                {transcribing ? (
                  <Icons.LoaderCircle size={17} className="animate-spin" />
                ) : listening ? (
                  <Icons.Square size={16} />
                ) : (
                  <Icons.Mic size={18} />
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
                      : "Ask about services, bookings, or the app…"
                }
                aria-label="Message Lucky"
                className="max-h-32 min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-transparent bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-800"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label="Send message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? (
                  <Icons.LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <Icons.Send size={17} />
                )}
              </button>
            </form>
            <p className="mt-2 text-center text-[10px] text-slate-400 dark:text-gray-500">
              Don’t share OTPs, passwords, or payment PINs.
            </p>
        </div>
      </main>
    </div>
  );
};
