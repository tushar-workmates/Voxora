import { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Send, 
  Database, 
  Bot, 
  User, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Trash2,
  Search,
  Languages,
  Sparkles,
  TrendingUp,
  Activity,
  DollarSign,
  Users,
  Mic,
  MicOff
} from 'lucide-react';
import { toast } from 'sonner';
import { useDbChat } from '@/hooks/useDbChat';

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5005";


interface Message {
  id: string;
  type: 'user' | 'ai';
  message: string;
  timestamp: string;
  data?: {
    query: string;
    results: any[];
  };
}

export default function DbChat() {
  const [message, setMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, sendMessage: sendDbMessage, isSending } = useDbChat();

  // Auto-scroll to latest message in chat container
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages, isLoading, isSending]);

  // Check connection on component mount
  useEffect(() => {
    checkConnection();
  }, []);

  const languages = [
    { code: "en", name: "English", flag: "🇺🇸" },
    { code: "es", name: "Spanish", flag: "🇪🇸" },
    { code: "fr", name: "French", flag: "🇫🇷" },
    { code: "de", name: "German", flag: "🇩🇪" },
    { code: "it", name: "Italian", flag: "🇮🇹" },
    { code: "pt", name: "Portuguese", flag: "🇵🇹" },
    { code: "ru", name: "Russian", flag: "🇷🇺" },
    { code: "ja", name: "Japanese", flag: "🇯🇵" },
    { code: "ko", name: "Korean", flag: "🇰🇷" },
    { code: "zh", name: "Chinese", flag: "🇨🇳" },
  ];

  const suggestedQueries = [
    "Show me today's revenue breakdown",
    "List top 10 customers by total orders", 
    "What's the conversion rate this month?",
    "Show me inventory levels below 10 units",
    "Get user engagement metrics",
    "Display monthly growth trends"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkConnection = async () => {
    setConnectionStatus('checking');
    try {
      const response = await fetch(`${API_URL}/api/health`);
      if (response.ok) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      console.error('Connection check failed:', error);
    }
  };



  const loadChat = async () => {
  const token = localStorage.getItem("token");

  const res = await fetch(
    `${API_URL}/api/chat/load/${sessionId}`,
    {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    }
  );

  const data = await res.json();
  if (data.success && data.messages) {
    setMessages(data.messages.map((m: any) => ({
      id: m.id,
      type: m.isUser ? "user" : "ai",
      message: m.text,
      timestamp: m.timestamp,
    })));
  }
};

// const loadChatFromBackend = async () => {
//   const token = localStorage.getItem("token");
//   if (!token) return;

//   try {
//     const res = await fetch(
//       `${API_BASE_URL}/api/chat/load/${sessionId}`,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     );

//     const data = await res.json();

//     if (data.success && data.messages?.length) {
//       setMessages(data.messages);
//     }
//   } catch (err) {
//     console.error("Failed to load chat:", err);
//   }
// };


 const formatResponse = (response: any): { message: string; data?: any } => {
  // ❌ error case
  if (!response.success) {
    return {
      message: response.error || response.message || "Something went wrong",
      data: undefined,
    };
  }

  // ✅ GREETING or TEXT-ONLY RESPONSE
  if (!response.results || response.results.length === 0) {
    return {
      message: response.message, // 👈 USE BACKEND MESSAGE
      data: undefined,
    };
  }

  // ✅ QUERY RESULT RESPONSE
  return {
    message: "I found the requested information. Here's the breakdown:",
    data: {
      query: response.query,
      results: response.results.slice(0, 4),
    },
  };
};


  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!message.trim() || isSending) return;

    sendDbMessage(message.trim());
    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([{
      id: "welcome",
      type: "ai",
      message: "Hello! I'm your SQL query assistant. I can help you query the PostgreSQL database. Try asking questions about employees, departments, salaries, or titles!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    toast.success('Conversation cleared');
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    toast.success(isRecording ? "Recording stopped" : "Recording started");
  };

  const ConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600 font-medium">Connected & Ready</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-xs text-red-600 font-medium">Disconnected</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-yellow-600 font-medium">Checking...</span>
          </div>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Database Chat</h1>
          <p className="text-muted-foreground">
            Query your database using natural language and get instant insights with AI
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up">
          <Card className="glass-card border-primary/20 hover:shadow-glow transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,247</div>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-accent/20 hover:shadow-glow transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Activity className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">89</div>
              <p className="text-xs text-muted-foreground">Current sessions</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-success/20 hover:shadow-glow transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders Today</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">156</div>
              <p className="text-xs text-muted-foreground">New orders</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-warning/20 hover:shadow-glow transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue (MTD)</CardTitle>
              <DollarSign className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$24.5K</div>
              <p className="text-xs text-muted-foreground">Month to date</p>
            </CardContent>
          </Card>
        </div>

        {/* Suggested Queries */}
        <Card className="glass-card animate-scale-in">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="w-5 h-5" />
              <span>Quick Query Suggestions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestedQueries.map((query, idx) => (
                <button
                  key={idx}
                  onClick={() => setMessage(query)}
                  className="text-left p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border-2 border-blue-200 hover:border-purple-300 transition-all duration-200 transform hover:scale-105"
                >
                  <div className="flex items-center space-x-3">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">{query}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Chat Interface */}
        <Card className="glass-card animate-slide-up border-2 border-gradient-to-r from-indigo-200 to-purple-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-t-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-cyan-700">Database Assistant</CardTitle>
                  <div className="flex items-center space-x-2 mt-1">
                    <ConnectionStatusBadge />
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearConversation}
                className="border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>

            {/* Language Control */}
            <div className="flex items-center space-x-3 p-4 bg-white/70 rounded-xl border-2 border-blue-100">
              <Languages className="w-4 h-4 text-blue-600" />
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-full bg-white border-2 border-blue-200 focus:border-purple-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <div className="flex items-center space-x-2">
                        <span>{lang.flag}</span>
                        <span className="text-sm">{lang.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div ref={messagesEndRef} className="h-96 overflow-y-auto p-6 space-y-4 bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Database className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-lg font-medium mb-2">Start a conversation with your database</p>
                  <p className="text-sm">Ask questions in natural language and get instant insights</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex items-start space-x-3 max-w-[80%] ${msg.isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
                          msg.isUser 
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white' 
                            : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                        }`}>
                          {msg.isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>
                        <div className={`rounded-2xl p-4 shadow-lg transition-all duration-300 ${
                          msg.isUser 
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white hover:scale-105' 
                            : 'bg-white border-2 border-gray-100 text-gray-800'
                        }`}>
                          <div className="text-sm leading-snug whitespace-pre-line">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                          {msg.query && (
                            <div className="mt-3 p-3 bg-black/10 rounded-lg border">
                              <div className="text-xs font-mono text-gray-600 mb-2 bg-gray-100 p-2 rounded">
                                SQL: {msg.query}
                              </div>
                              {/* {msg.results && msg.results.length > 0 && (
                                <div className="space-y-1">
                                  {msg.results.map((row: any, idx: number) => (
                                    <div key={idx} className="text-xs font-mono bg-gray-50 p-2 rounded">
                                      {JSON.stringify(row)}
                                    </div>
                                  ))}
                                </div>
                              )} */}
                            </div>
                          )}
                          <div className="text-xs opacity-70 mt-2">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(isLoading || isSending) && (
                    <div className="flex justify-start">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-gray-100">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce delay-100"></div>
                            <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce delay-200"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t-2 border-gray-100 p-4 bg-gradient-to-r from-indigo-50 to-purple-50">
              <form onSubmit={handleSendMessage} className="flex space-x-3">
                <div className="flex-1 relative">
                  <input
                    id="message"
                    name="message"
                    placeholder="Ask about your database... e.g. 'Show me users who signed up this week'"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isSending}
                    className="w-full border-2 border-indigo-200 focus:border-purple-400 bg-white shadow-lg rounded-xl pr-12 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={toggleRecording}
                    className={`absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full w-8 h-8 p-0 ${
                      isRecording 
                        ? "text-red-500 bg-red-50 hover:bg-red-100" 
                        : "text-blue-500 bg-blue-50 hover:bg-blue-100"
                    }`}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                </div>
                <Button 
                  type="submit" 
                  disabled={!message.trim() || isSending || connectionStatus === 'disconnected'}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 rounded-xl px-6"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
              
              {/* Connection Warning */}
              {connectionStatus === 'disconnected' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-red-800">Backend not connected</div>
                      <div className="text-xs text-red-600">
                        Make sure the backend server is running at {API_URL}
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={checkConnection}
                      className="text-xs h-7 border-red-300 text-red-700 hover:bg-red-50"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}