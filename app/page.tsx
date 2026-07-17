//@ts-nocheck
'use client';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiCpu, FiUser, FiDownload, FiCopy, FiMic, FiMicOff, FiX, FiRefreshCw, FiImage, FiMenu, FiTrash2 } from 'react-icons/fi';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Message = { role: 'user' | 'assistant'; content: string; image?: string };
type Chat = { id: string; title: string; messages: Message[] };

export default function Page() {
  const [darkMode, setDarkMode] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState<string>('Guest');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const messages = chats.find(c => c.id === currentChatId)?.messages || [];

  const createNewChat = () => {
    const newChat: Chat = { id: Date.now().toString(), title: 'New Chat', messages: [] };
    setChats(prev => [newChat,...prev]);
    setCurrentChatId(newChat.id);
    setSidebarOpen(false);
    setImagePreview(null);
  };

  const deleteChat = (chatId: string) => {
    if(!confirm('Chat delete karna hai?')) return;
    setChats(prev => prev.filter(chat => chat.id!== chatId));
    if (currentChatId === chatId) {
      const remaining = chats.filter(c => c.id!== chatId);
      setCurrentChatId(remaining[0]?.id || '');
      if (remaining.length === 0) setTimeout(() => createNewChat(), 100);
    }
  };

  const updateCurrentChat = (newMessages: Message[]) => {
    setChats(prev => prev.map(chat =>
      chat.id === currentChatId
       ? {...chat, title: chat.messages.length === 0 && newMessages.length > 0? newMessages[0].content.slice(0, 30) : chat.title, messages: newMessages }
        : chat
    ));
  };

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    const savedChats = localStorage.getItem('all-chats');
    const savedName = localStorage.getItem('user-name');
    if (savedName) setUserName(savedName);
    else {
      const name = prompt('Bhai tera naam kya hai?');
      const finalName = name && name.trim()? name.trim() : 'Dost';
      setUserName(finalName);
      localStorage.setItem('user-name', finalName);
    }
    if (savedChats) {
      try {
        const parsed = JSON.parse(savedChats);
        if (parsed.length > 0) {
          setChats(parsed);
          setCurrentChatId(parsed[0].id);
        } else createNewChat();
      } catch { createNewChat(); }
    } else createNewChat();
  }, []);

  useEffect(() => {
    if (typeof window!== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'hi-IN';
        recognitionRef.current.onresult = (event: any) => {
          setInput(event.results[0][0].transcript);
          setIsListening(false);
        };
        recognitionRef.current.onerror = () => setIsListening(false);
        recognitionRef.current.onend = () => setIsListening(false);
      }
    }
  }, []);

  useEffect(() => {
    if (chats.length > 0) localStorage.setItem('all-chats', JSON.stringify(chats));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats]);

  const toggleListening = () => {
    if (!recognitionRef.current) { alert('Chrome use kar bhai'); return; }
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else { recognitionRef.current.start(); setIsListening(true); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const exportToPDF = async () => {
    if (messages.length === 0) { alert('Pehle chat to kar bhai!'); return; }
    try {
      const pdf = new jsPDF();
      pdf.setFontSize(14);
      pdf.text(`Hindustani AI INK - ${userName} ka Chat`, 10, 15);
      let y = 25;
      pdf.setFontSize(11);
      messages.forEach((m) => {
        const role = m.role === 'user'? userName : 'Hindustani AI';
        const text = `${role}: ${m.content}`;
        const lines = pdf.splitTextToSize(text, 180);
        if (y + lines.length * 7 > 280) { pdf.addPage(); y = 15; }
        pdf.text(lines, 10, y);
        y += lines.length * 7 + 10;
      });
      pdf.save(`Hindustani-Chat-${Date.now()}.pdf`);
    } catch (e) { alert('PDF banane me error'); }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const regenerateLastResponse = async () => {
    if (messages.length < 2) return;
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return;
    const newMessages = messages.slice(0, -1);
    updateCurrentChat(newMessages);
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: newMessages.concat(lastUserMessage) }) });
      const data = await res.json();
      updateCurrentChat([...newMessages, { role: 'assistant', content: data.reply || 'Error' }]);
    } catch { updateCurrentChat([...newMessages, { role: 'assistant', content: 'Network error' }]); }
    finally { setIsLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() &&!imagePreview) return;
    const userMsg: Message = { role: 'user', content: input, image: imagePreview || undefined };
    const newMessages = [...messages, userMsg];
    updateCurrentChat(newMessages);
    const toSend = [...newMessages];
    setInput("");
    setImagePreview(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: toSend, userName }) });
      const data = await res.json();
      updateCurrentChat([...toSend, { role: 'assistant', content: data.reply } as Message]);
    } catch { updateCurrentChat([...toSend, { role: 'assistant', content: 'Bhai server me error aa gaya' } as Message]); }
    setIsLoading(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-black dark:text-white overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className={`fixed md:static z-50 h-full w-72 bg-gray-900 text-white flex flex-col transition-transform ${sidebarOpen? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h1 className="text-xl font-bold">Hindustani AI</h1>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 rounded hover:bg-gray-700"><FiX size={20} /></button>
        </div>
        <div className="p-3">
          <button onClick={createNewChat} className="w-full p-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-bold">+ New Chat</button>
          <div className="mt-3 p-2 rounded bg-gray-800 text-xs text-center">👤 {userName}</div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 px-3 mt-2">
          {chats.map((chat) => (
            <div key={chat.id} className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer ${currentChatId === chat.id? 'bg-gray-700' : 'hover:bg-gray-800'}`}>
              <button onClick={() => { setCurrentChatId(chat.id); setSidebarOpen(false); }} className="flex-1 text-left truncate text-sm">{chat.title}</button>
              <button onClick={() => deleteChat(chat.id)} className="ml-2 p-1.5 rounded hover:bg-red-600"><FiTrash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 md:hidden"><FiMenu size={20} /></button>
            <h1 className="text-lg md:text-xl font-bold">Hindustani AI INK</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={exportToPDF} className="p-2.5 rounded-lg bg-green-500 text-white"><FiDownload size={18} /></button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-lg bg-gray-200 dark:bg-gray-700">{darkMode? '☀️' : '🌙'}</button>
          </div>
        </div>

        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center"><h2 className="text-2xl font-bold mb-2">Hindustani AI INK</h2><p>Kya madad chahiye {userName}? ✍️</p></div>
            </div>
          )}

          {messages.map((m, i) => {
            // Image nikalne ka fix logic - bina regex // ke
            let imgUrl = "";
            let textOnly = m.content;
            if (m.content.includes("](") && m.content.includes("http")) {
              const s = m.content.indexOf("](") + 2;
              const e = m.content.indexOf(")", s);
              if (s > 1 && e > s) {
                imgUrl = m.content.substring(s, e);
                textOnly = m.content.split("!")[0];
              }
            } else if (m.content.startsWith("https://") && (m.content.includes(".png") || m.content.includes(".jpg") || m.content.includes(".webp"))) {
              imgUrl = m.content.trim();
              textOnly = "";
            }

            return (
              <div key={i} className={`flex gap-3 ${m.role === 'user'? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl ${m.role === 'user'? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 border shadow-sm'}`}>
                  {m.image && <img src={m.image} alt="uploaded" className="max-w-[250px] rounded-xl mb-2" />}
                  {textOnly && <div className="text-sm whitespace-pre-wrap"><ReactMarkdown>{textOnly}</ReactMarkdown></div>}
                  {imgUrl && <img src={imgUrl} alt="generated" className="mt-2 max-w-[320px] rounded-xl border" />}
                  {m.role === 'assistant' && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => copyToClipboard(m.content, i)} className="text-xs opacity-60 hover:opacity-100 flex items-center gap-1"><FiCopy size={12}/>{copiedIndex===i?'Copied':'Copy'}</button>
                      {i === messages.length-1 && <button onClick={regenerateLastResponse} className="text-xs opacity-60 hover:opacity-100 flex items-center gap-1"><FiRefreshCw size={12}/>Regen</button>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {isLoading && <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit text-sm">Soach raha hu...</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t bg-white dark:bg-gray-800 shrink-0">
          {imagePreview && (
            <div className="mb-2 relative w-fit">
              <img src={imagePreview} alt="preview" className="w-20 h-20 object-cover rounded-xl border" />
              <button onClick={() => setImagePreview(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><FiX size={12}/></button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700"><FiImage size={18}/></button>
            <button type="button" onClick={toggleListening} className={`p-3 rounded-xl ${isListening?'bg-red-500 text-white':'bg-gray-100 dark:bg-gray-700'}`}>{isListening?<FiMicOff size={18}/>:<FiMic size={18}/>}</button>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message likh..." className="flex-1 border dark:border-gray-600 rounded-xl px-4 py-3 text-sm bg-transparent focus:outline-none" />
            <button type="submit" disabled={isLoading} className="px-5 py-3 rounded-xl bg-black dark:bg-white dark:text-black text-white text-sm font-bold">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}