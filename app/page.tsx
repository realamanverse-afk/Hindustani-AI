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
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setSidebarOpen(false);
    setImagePreview(null);
  };

  const deleteChat = (chatId: string) => {
    if(!confirm('Chat delete karna hai?')) return;
    setChats(prev => prev.filter(chat => chat.id !== chatId));
    if (currentChatId === chatId) {
      const remaining = chats.filter(c => c.id !== chatId);
      setCurrentChatId(remaining[0]?.id || '');
      if (remaining.length === 0) {
        setTimeout(() => createNewChat(), 100);
      }
    }
  };

  const updateCurrentChat = (newMessages: Message[]) => {
    setChats(prev => prev.map(chat => 
      chat.id === currentChatId 
        ? { ...chat, title: chat.messages.length === 0 && newMessages.length > 0 ? newMessages[0].content.slice(0, 30) : chat.title, messages: newMessages }
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
      const finalName = name && name.trim() ? name.trim() : 'Dost';
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
    if (typeof window !== 'undefined') {
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
    if (messages.length === 0) {
      alert('Pehle chat to kar bhai!');
      return;
    }
    try {
      const pdf = new jsPDF();
      pdf.setFontSize(14);
      pdf.text(`Hindustani AI INK - ${userName} ka Chat`, 10, 15);
      
      let y = 25;
      pdf.setFontSize(11);

      messages.forEach((m) => {
        const role = m.role === 'user' ? userName : 'Hindustani AI';
        const text = `${role}: ${m.content}`;
        const lines = pdf.splitTextToSize(text, 180); // 180mm width me wrap karega

        if (y + lines.length * 7 > 280) {
          pdf.addPage();
          y = 15;
        }
        pdf.text(lines, 10, y);
        y += lines.length * 7 + 10;
      });

      pdf.save(`Hindustani-Chat-${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
      alert('PDF banane me error aa gaya bhai');
    }
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
    if ((!input.trim() && !imagePreview) || isLoading) return;
    const userMessage: Message = { role: 'user', content: input, image: imagePreview || undefined };
    const newMessages = [...messages, userMessage];
    updateCurrentChat(newMessages);
    setInput(''); setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: newMessages }) });
      const data = await res.json();
      updateCurrentChat([...newMessages, { role: 'assistant', content: data.reply || 'Error' }]);
    } catch { updateCurrentChat([...newMessages, { role: 'assistant', content: 'Server down' }]); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-black dark:text-white overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`fixed md:static z-50 h-full w-72 bg-gray-900 text-white flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:w-64`}>
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h1 className="text-xl font-bold">Hindustani AI INK</h1>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 rounded hover:bg-gray-700"><FiX size={20} /></button>
        </div>
        
        <div className="p-3">
          <button onClick={createNewChat} className="w-full p-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-bold">+ New Chat</button>
          <div className="mt-3 p-2 rounded bg-gray-800 text-xs text-center">👤 {userName}</div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 px-3 mt-2">
          {chats.map((chat) => (
            <div key={chat.id} className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer ${currentChatId === chat.id ? 'bg-gray-700' : 'hover:bg-gray-800'}`}>
              <button onClick={() => { setCurrentChatId(chat.id); setSidebarOpen(false); }} className="flex-1 text-left truncate text-sm">
                {chat.title}
              </button>
              <button onClick={() => deleteChat(chat.id)} className="ml-2 p-1.5 rounded hover:bg-red-600 bg-gray-600 md:bg-transparent md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-all">
                <FiTrash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 md:hidden">
              <FiMenu size={20} />
            </button>
            <h1 className="text-lg md:text-xl font-bold">Hindustani AI INK</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={exportToPDF} className="p-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white"><FiDownload size={18} /></button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-lg bg-gray-200 dark:bg-gray-700">{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </div>

        <div ref={chatRef} className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center px-4">
                <h2 className="text-2xl font-bold mb-2">Hindustani AI INK</h2>
                <p>Kya madad chahiye {userName}? ✍️</p>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className="mb-6 group">
              <div className="flex gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-blue-500' : 'bg-green-500'}`}>
                  {m.role === 'user' ? <FiUser size={16} className="text-white" /> : <FiCpu size={16} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold mb-1">{m.role === 'user' ? userName : 'Hindustani AI'}</p>
                  {m.image && <img src={m.image} alt="uploaded" className="max-w-[280px] rounded-lg mb-2 border" />}
                  <div className="prose dark:prose-invert max-w-none break-words">
                    <ReactMarkdown components={{
                      code({ node, className, children }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;
                        return !isInline ? (
                          <div className="relative group/code">
                            <button onClick={() => copyToClipboard(String(children), i)} className="absolute right-2 top-2 p-2 rounded bg-gray-700 hover:bg-gray-600 opacity-0 group-hover/code:opacity-100 transition">
                              {copiedIndex === i ? '✓' : <FiCopy size={14} />}
                            </button>
                            <SyntaxHighlighter language={match ? match[1] : undefined} style={darkMode ? oneDark : oneLight} PreTag="div">{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                          </div>
                        ) : <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{children}</code>;
                      }
                    }}>{m.content}</ReactMarkdown>
                  </div>
                  {m.role === 'assistant' && m.content && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => copyToClipboard(m.content, i)} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"><FiCopy size={12} /> {copiedIndex === i ? 'Copied!' : 'Copy'}</button>
                      {i === messages.length - 1 && <button onClick={regenerateLastResponse} disabled={isLoading} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"><FiRefreshCw size={12} /> Regenerate</button>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"><FiCpu size={16} className="text-white" /></div>
              <div className="flex-1"><p className="font-semibold mb-1">Hindustani AI</p><div className="flex gap-1"><div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div><div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div></div></div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
          {imagePreview && (
            <div className="mb-2 relative inline-block">
              <img src={imagePreview} alt="preview" className="max-h-20 rounded border" />
              <button onClick={() => { setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"><FiX size={14} /></button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 rounded-lg border bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 shrink-0"><FiImage size={20} /></button>
            <button type="button" onClick={toggleListening} className={`p-3 rounded-lg border shrink-0 ${isListening ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}>{isListening ? <FiMicOff size={20} /> : <FiMic size={20} />}</button>
            <input className="flex-1 min-w-0 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" value={input} placeholder={isListening ? "Bol raha hu..." : "Yahan likh bhai..."} onChange={(e) => setInput(e.target.value)} disabled={isLoading} />
            <button type="submit" disabled={isLoading || (!input.trim() && !imagePreview)} className="px-4 md:px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-semibold shrink-0">Bhej</button>
          </form>
        </div>
      </div>
    </div>
  );
}
