'use client';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { FiCopy, FiRefreshCw, FiMenu, FiX, FiUser, FiCpu, FiMic, FiMicOff, FiImage, FiDownload } from 'react-icons/fi';
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
  const [userName, setUserName] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const messages = chats.find(c => c.id === currentChatId)?.messages || [];

  // Dark mode
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Load chats + name
  useEffect(() => {
    const savedChats = localStorage.getItem('all-chats');
    const savedName = localStorage.getItem('user-name');

    if (savedName) {
      setUserName(savedName);
    } else {
      const name = prompt('Bhai tera naam kya hai?');
      const finalName = name && name.trim()? name.trim() : 'Dost';
      setUserName(finalName);
      localStorage.setItem('user-name', finalName);
    }

    if (savedChats) {
      const parsed = JSON.parse(savedChats);
      setChats(parsed);
      if (parsed.length > 0) setCurrentChatId(parsed[0].id);
      else createNewChat();
    } else {
      createNewChat();
    }
  }, []);

  // Setup Voice Recognition
  useEffect(() => {
    if (typeof window!== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'hi-IN';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(prev => prev + ' ' + transcript);
          setIsListening(false);
        };

        recognitionRef.current.onerror = () => {
          setIsListening(false);
          alert('Mic error! Browser permission de bhai.');
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  // Save chats + auto scroll
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
      alert('Pehle kuch chat karo bhai!');
      return;
    }

    const canvas = await html2canvas(chatRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: darkMode? '#1f2937' : '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Hindustani-AI-Chat-${Date.now()}.pdf`);
  };

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: []
    };
    setChats(prev => [newChat,...prev]);
    setCurrentChatId(newChat.id);
    setSidebarOpen(false);
    setImagePreview(null);
  };

  const updateCurrentChat = (newMessages: Message[]) => {
    setChats(prev => prev.map(chat => {
      if (chat.id === currentChatId) {
        const title = newMessages[0]?.content.slice(0, 30) || 'New Chat';
        return {...chat, messages: newMessages, title };
      }
      return chat;
    }));
  };

  const deleteChat = (id: string) => {
    const updated = chats.filter(c => c.id!== id);
    setChats(updated);
    if (currentChatId === id) {
      if (updated.length > 0) setCurrentChatId(updated[0].id);
      else createNewChat();
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const regenerateLastResponse = async () => {
    if (messages.length < 2 || isLoading) return;

    const newMessages = messages.slice(0, -1);
    updateCurrentChat(newMessages);
    setIsLoading(true);
    updateCurrentChat([...newMessages, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: newMessages,
          userName: userName
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const chunk = decoder.decode(value);

        setChats(prev => prev.map(chat => {
          if (chat.id === currentChatId) {
            const updatedMessages = [...chat.messages];
            const lastMsg = updatedMessages[updatedMessages.length - 1];
            if (lastMsg?.role === 'assistant') {
              updatedMessages[updatedMessages.length - 1] = {
               ...lastMsg,
                content: lastMsg.content + chunk
              };
            }
            return {...chat, messages: updatedMessages };
          }
          return chat;
        }));
      }
    } catch (error) {
      console.error(error);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() &&!imagePreview) || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input || 'Is image ke baare me batao',
      image: imagePreview || undefined
    };
    const newMessages = [...messages, userMessage];
    updateCurrentChat(newMessages);
    setInput('');
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);

    updateCurrentChat([...newMessages, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          userName: userName,
          image: userMessage.image
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const chunk = decoder.decode(value);

        setChats(prev => prev.map(chat => {
          if (chat.id === currentChatId) {
            const updatedMessages = [...chat.messages];
            const lastMsg = updatedMessages[updatedMessages.length - 1];
            if (lastMsg?.role === 'assistant') {
              updatedMessages[updatedMessages.length - 1] = {
               ...lastMsg,
                content: lastMsg.content + chunk
              };
            }
            return {...chat, messages: updatedMessages };
          }
          return chat;
        }));
      }
    } catch (error) {
      console.error(error);
    }
    setIsLoading(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-black dark:text-white">
      {/* Sidebar */}
      <div className={`${sidebarOpen? 'w-64' : 'w-0'} transition-all duration-300 bg-gray-900 text-white overflow-hidden md:w-64`}>
        <div className="p-4 h-full flex flex-col">
          <button
            onClick={createNewChat}
            className="w-full p-3 mb-4 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700"
          >
            + New Chat
          </button>
          <div className="flex-1 overflow-y-auto space-y-2">
            {chats.map(chat => (
              <div
                key={chat.id}
                className={`p-3 rounded-lg cursor-pointer group flex justify-between items-center ${
                  currentChatId === chat.id? 'bg-gray-700' : 'hover:bg-gray-800'
                }`}
                onClick={() => {
                  setCurrentChatId(chat.id);
                  setSidebarOpen(false);
                }}
              >
                <span className="truncate text-sm">{chat.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                >
                  <FiX size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400">{userName}</p>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden">
              <FiMenu size={24} />
            </button>
            <h1 className="text-xl font-bold">Hindustani AI IN</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToPDF}
              className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white"
              title="Download PDF"
            >
              <FiDownload size={20} />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700"
            >
              {darkMode? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">
