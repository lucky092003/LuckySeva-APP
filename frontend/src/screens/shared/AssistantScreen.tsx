import { FormEvent, useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { TopBar } from '@/components/PhoneShell';
import { ApiError, api } from '@/services/api';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  failed?: boolean;
};

const CUSTOMER_PROMPTS = [
  'Which service should I book for a leaking tap?',
  'How does live booking tracking work?',
  'How do I reschedule a booking?',
];
const PROVIDER_PROMPTS = [
  'How do I start a customer journey?',
  'When should I share my live location?',
  'How do I manage incoming requests?',
];

const createMessage = (role: ChatMessage['role'], content: string, failed = false): ChatMessage => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  role,
  content,
  failed,
});

export const AssistantScreen = () => {
  const { role } = useApp();
  const isProvider = role === 'provider';
  const prompts = isProvider ? PROVIDER_PROMPTS : CUSTOMER_PROMPTS;
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      'assistant',
      isProvider
        ? 'Hi! I’m Lucky, your Partner assistant. Ask me about requests, job steps, location sharing, or using the app.'
        : 'Hi! I’m Lucky, your home-services assistant. Ask me about choosing a service, bookings, tracking, or using the app.',
    ),
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const messagesEnd = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const recordingTimer = useRef<number | null>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  useEffect(() => () => {
    if (recordingTimer.current != null) window.clearTimeout(recordingTimer.current);
    if (recorder.current?.state === 'recording') {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    window.speechSynthesis?.cancel();
  }, []);

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;

    const outgoing = createMessage('user', content);
    const history = [...messages, outgoing];
    setMessages(history);
    setDraft('');
    setVoiceError('');
    setSending(true);
    try {
      const response = await api.assistant.chat(
        history.slice(-16).map(({ role: messageRole, content: messageContent }) => ({ role: messageRole, content: messageContent })),
      );
      setMessages((current) => [...current, createMessage('assistant', response.reply)]);
    } catch (error) {
      const message = error instanceof ApiError && error.status === 404
        ? 'The AI assistant is not deployed on this backend yet. Deploy the chatbot backend update, then try again.'
        : error instanceof Error
          ? error.message
          : 'Lucky could not reply right now. Please try again.';
      setMessages((current) => [...current, createMessage('assistant', message, true)]);
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
      setVoiceError('The voice recording was empty. Please try again.');
      return;
    }
    setTranscribing(true);
    setVoiceError('');
    try {
      const result = await api.assistant.transcribe(audio);
      setDraft((current) => current ? `${current} ${result.text}` : result.text);
    } catch (error) {
      setVoiceError(
        error instanceof ApiError && error.status === 404
          ? 'Voice assistant is not deployed on this backend yet. Deploy the chatbot backend update, then try again.'
          : error instanceof Error
            ? error.message
            : 'Could not transcribe your voice. Please try again.',
      );
    } finally {
      setTranscribing(false);
    }
  };

  const startAudioRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('Voice input is not supported here. You can still type your message.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
      const nextRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunks.current = [];
      mediaStream.current = stream;
      recorder.current = nextRecorder;
      nextRecorder.ondataavailable = (event) => {
        if (event.data.size) audioChunks.current.push(event.data);
      };
      nextRecorder.onerror = () => {
        setVoiceError('Voice recording failed. Please try again or type your message.');
        setListening(false);
        stream.getTracks().forEach((track) => track.stop());
        mediaStream.current = null;
      };
      nextRecorder.onstop = () => {
        setListening(false);
        if (recordingTimer.current != null) window.clearTimeout(recordingTimer.current);
        recordingTimer.current = null;
        stream.getTracks().forEach((track) => track.stop());
        mediaStream.current = null;
        const audio = new Blob(audioChunks.current, { type: nextRecorder.mimeType || 'audio/webm' });
        audioChunks.current = [];
        void transcribeAudio(audio);
      };
      setListening(true);
      nextRecorder.start();
      recordingTimer.current = window.setTimeout(() => {
        setVoiceError('Voice recording reached the 60-second limit and is being transcribed.');
        if (nextRecorder.state === 'recording') nextRecorder.stop();
      }, 60_000);
    } catch (error) {
      setListening(false);
      setVoiceError(error instanceof Error && error.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow microphone access and try again.' : 'Could not start voice recording. Please try again.');
    }
  };

  const toggleVoiceInput = () => {
    if (listening) {
      if (recorder.current?.state === 'recording') recorder.current.stop();
      return;
    }
    void startAudioRecording();
  };

  const speak = (text: string) => {
    if (!window.speechSynthesis) {
      setVoiceError('Voice playback is not supported in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = navigator.language || 'en-IN';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-gray-950">
      <TopBar title="Lucky AI Assistant" />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-8 lg:px-[25px] lg:py-6">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-5xl">
          <header className="hidden shrink-0 items-center gap-4 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:flex">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/15"><Icons.Sparkles size={22} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">{isProvider ? 'Partner support' : 'Customer support'}</p>
              <h1 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-gray-100">Ask Lucky anything</h1>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">Voice or chat, in English, Hindi, or Hinglish.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ready to help</span>
          </header>

          <section className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 lg:mt-4 lg:rounded-2xl lg:border lg:border-slate-200/80 lg:bg-white lg:px-6 lg:py-6 lg:shadow-sm dark:lg:border-gray-800 dark:lg:bg-gray-900">
            {messages.length === 1 && (
              <div className="mb-6 lg:mb-8">
                <p className="text-xs font-semibold text-slate-500 dark:text-gray-400">Try asking</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {prompts.map((prompt) => (
                    <button key={prompt} onClick={() => void sendMessage(prompt)} disabled={sending} className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 lg:bg-slate-50">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-5">
              {messages.map((message) => (
                <article key={message.id} className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${message.role === 'assistant' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {message.role === 'assistant' ? <Icons.Sparkles size={17} /> : <Icons.UserRound size={17} />}
                  </span>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed lg:max-w-[78%] ${message.role === 'user' ? 'rounded-tr-md bg-emerald-700 text-white' : message.failed ? 'rounded-tl-md border border-amber-200 bg-amber-50 text-amber-900' : 'rounded-tl-md border border-slate-200 bg-white text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 lg:bg-slate-50 dark:lg:bg-gray-950'}`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.role === 'assistant' && !message.failed && (
                      <button onClick={() => speak(message.content)} aria-label="Read response aloud" className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-400 transition hover:bg-white hover:text-emerald-700 dark:hover:bg-gray-800 dark:hover:text-emerald-400">
                        <Icons.Volume2 size={13} /> Listen
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {sending && (
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Icons.Sparkles size={17} /></span>
                  <span className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:240ms]" /> Lucky is thinking</span>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>
          </section>

          <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-3 pt-3 dark:border-gray-800 dark:bg-gray-900 lg:mt-3 lg:rounded-2xl lg:border lg:px-4">
            {voiceError && <p role="status" className="mb-2 text-xs text-amber-700">{voiceError}</p>}
            <form onSubmit={submit} className="flex items-end gap-2">
              <button type="button" onClick={toggleVoiceInput} disabled={transcribing} aria-label={transcribing ? 'Transcribing voice input' : listening ? 'Stop voice input' : 'Start voice input'} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-50 ${listening ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-700'}`}>
                {transcribing ? <Icons.LoaderCircle size={17} className="animate-spin" /> : listening ? <Icons.Square size={16} /> : <Icons.Mic size={18} />}
              </button>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(draft);
                  }
                }}
                maxLength={2000}
                rows={1}
                placeholder={transcribing ? 'Transcribing voice note…' : listening ? 'Listening…' : 'Ask about services, bookings, or the app…'}
                aria-label="Message Lucky"
                className="max-h-32 min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-800"
              />
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">
                {sending ? <Icons.LoaderCircle size={17} className="animate-spin" /> : <Icons.Send size={17} />}
              </button>
            </form>
            <p className="mt-2 text-center text-[10px] text-slate-400 dark:text-gray-500">Don’t share OTPs, passwords, or payment PINs with anyone.</p>
          </div>
        </main>

        <aside className="hidden w-[250px] shrink-0 flex-col gap-4 xl:flex">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icons.ShieldCheck size={19} /></span>
            <h2 className="mt-3 text-sm font-bold text-slate-900 dark:text-gray-100">Helpful, with boundaries</h2>
            <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-gray-400">Lucky can guide you through the app, but cannot view private booking details or make account changes.</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Quick tips</h2>
            <ul className="mt-3 space-y-3 text-xs leading-5 text-slate-500 dark:text-gray-400">
              <li className="flex gap-2"><Icons.Languages size={15} className="mt-0.5 shrink-0 text-emerald-600" />Ask in English, Hindi, or Hinglish.</li>
              <li className="flex gap-2"><Icons.Mic size={15} className="mt-0.5 shrink-0 text-emerald-600" />Use the microphone to dictate a question.</li>
              <li className="flex gap-2"><Icons.Volume2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />Tap Listen to hear a reply.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};
