'use client';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiCpu, FiUser, FiDownload, FiCopy, FiMic, FiMicOff, FiX, FiRefreshCw, FiImage } from 'react-icons/fi';
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

  const handleLogin = () => {
    const name = prompt('Apna naam daal bhai:');
    if (name) {
      setUserName(name);
      localStorage.setItem('user-name', name);
    }
  };

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    const savedChats = localStorage.getItem('all-chats');
    const savedName = localStorage.getItem('user-name');
    if (savedName) {
      setUserName(savedName);
    } else {
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
        } else {
          createNewChat();
        }
      } catch {
        createNewChat();
      }
    } else {
      createNewChat();
    }
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
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          setIsListening(false);
        };
        recognitionRef.current.onerror = () => setIsListening(false);
        recognitionRef.current.onend = () => setIsListening(false);
      }
    }
  }, []);

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('all-chats', JSON.stringify(chats));
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Bhai tere browser me voice support nahi hai. Chrome use kar.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const exportToPDF = async () => {
    if (!chatRef.current || messages.length === 0) {
      alert('Pehle chat to kar bhai!');
      return;
    }
    const canvas = await html2canvas(chatRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: darkMode ? '#1f2937' : '#ffffff'
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Hindustani-AI-Chat-${Date.now()}.pdf`);
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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.concat(lastUserMessage) })
      });
      const data = await res.json();
      updateCurrentChat([...newMessages, { role: 'assistant', content: data.reply || 'Bhai error aa gaya' }]);
    } catch {
      updateCurrentChat([...newMessages, { role: 'assistant', content: 'Bhai network error' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !imagePreview) || isLoading) return;
    const userMessage: Message = { role: 'user', content: input, image: imagePreview || undefined };
    const newMessages = [...messages, userMessage];
    updateCurrentChat(newMessages);
    setInput('');
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });
      const data = await res.json();
      const assistantMessage: Message = { role: 'assistant', content: data.reply || 'Bhai kuch to gadbad hai' };
      updateCurrentChat([...newMessages, assistantMessage]);
    } catch (error) {
      updateCurrentChat([...newMessages, { role: 'assistant', content: 'Bhai server down lag raha hai' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-black dark:text-white">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <div className={`fixed md:static z-50 h-full w-64 bg-gray-900 text-white flex flex-col transition-all duration-300 ${sidebarOpen ? 'left-0' : '-left-64 md:left-0'}`}>
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h1 className="text-xl font-bold">Hindustani AI INK</h1>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden"><FiX /></button>
        </div>
        
        <div className="p-2">
          <button onClick={createNewChat} className="w-full p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-bold">
            + New Chat
          </button>
          <button onClick={handleLogin} className="w-full mt-2 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs">
            👤 {userName}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 px-2 mt-2">
          {chats.map((chat) => (
            <div key={chat.id} className={`p-3 rounded-lg cursor-pointer group flex justify-between items-center ${currentChatId === chat.id ? 'bg-gray-700' : 'hover:bg-gray-800'}`}>
              <button onClick={() => { setCurrentChatId(chat.id); setSidebarOpen(false); }} className="flex-1 text-left truncate text-sm">
                {chat.title}
              </button>
              <button onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }} className="opacity-0 group-hover:opacity-100 text-red-400 ml-2">
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} onTouchStart={() => setSidebarOpen(!sidebarOpen)} className="text-xl mr-2" style={{ zIndex: 9999 }}>
              ☰
            </button>
            <h1 className="text-xl font-bold">Hindustani AI INK</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={exportToPDF} className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white" title="Download PDF">
              <FiDownload size={20} />
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700">
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        <div ref={chatRef} className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Hindustani AI INK</h2>
                <p>Kya madad chahiye {userName}? Photo bhej ya bol ke type kar ✍️</p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className="mb-6 group">
              <div className="flex gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-blue-500' : 'bg-green-500'}`}>
                  {m.role === 'user' ? <FiUser size={16} className="text-white" /> : <FiCpu size={16} className="text-white" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold mb-1">{m.role === 'user' ? userName : 'Hindustani AI'}</p>
                  {m.image && (
                    <img src={m.image} alt="uploaded" className="max-w-sm rounded-lg mb-2 border border-gray-300 dark:border-gray-600" />
                  )}
                  <div className="prose dark:prose-invert max-w-none">
                    <ReactMarkdown components={{
                      code({ node, className, children }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;
                        return !isInline ? (
                          <div className="relative group/code">
                            <button onClick={() => copyToClipboard(String(children), i)} className="absolute right-2 top-2 p-2 rounded bg-gray-700 hover:bg-gray-600 opacity-0 group-hover/code:opacity-100 transition">
                              {copiedIndex === i ? '✓' : <FiCopy size={14} />}
                            </button>
                            <SyntaxHighlighter customStyle={{}} language={match ? match[1] : undefined} style={darkMode ? oneDark : oneLight} PreTag="div">
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          </div>
                        ) : (
                          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{children}</code>
                        );
                      }
                    }}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                  {m.role === 'assistant' && m.content && (
                    <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => copyToClipboard(m.content, i)} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">
                        <FiCopy size={12} /> {copiedIndex === i ? 'Copied!' : 'Copy'}
                      </button>
                      {i === messages.length - 1 && (
                        <button onClick={regenerateLastResponse} disabled={isLoading} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">
                          <FiRefreshCw size={12} /> Regenerate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <FiCpu size={16} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold mb-1">Hindustani AI</p>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {imagePreview && (
            <div className="mb-2 relative inline-block">
              <img src={imagePreview} alt="preview" className="max-h-20 rounded border border-gray-300" />
              <button onClick={() => { setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                <FiX size={14} />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 rounded-lg border bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600" title="Upload Image">
              <FiImage size={20} />
            </button>
            <button type="button" onClick={toggleListening} className={`p-3 rounded-lg border ${isListening ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
              {isListening ? <FiMicOff size={20} /> : <FiMic size={20} />}
            </button>
            <input className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" value={input} placeholder={isListening ? "Bol raha hu..." : "Yahan likh bhai ya photo bhejo..."} onChange={(e) => setInput(e.target.value)} disabled={isLoading} />
            <button type="submit" disabled={isLoading || (!input.trim() && !imagePreview)} className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-semibold">
              Bhej
            </button>
          </form>
          {isListening && (
            <p className="text-center text-sm text-red-500 mt-2 animate-pulse">
              🎙️ Listening... Bolo bhai
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

