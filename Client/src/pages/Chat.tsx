import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Send, 
  Mic, 
  MicOff,
  Copy,
  Code,
  Eye,
  MessageCircle,
  Languages,
  Sparkles,
  Zap,
  TrendingUp,
  Users,
  Clock,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { uploadPdf } from '@/services/api';
import { useChat, useLogout } from '@/hooks/useChat';

const ASSISTANT_MESSAGE_STYLE = `
  text-sm leading-snug font-normal
  prose prose-sm max-w-none
  whitespace-pre-line

  prose-p:my-0
  prose-ul:my-0.5
  prose-ol:my-0.5
  prose-li:my-0
  prose-strong:font-medium

  prose-headings:mt-0
  prose-headings:mb-1
  prose-headings:font-semibold
  prose-headings:text-gray-900

   p { margin: 0.5rem 0; }
  ul, ol { margin: 0.5rem 0; padding-left: 1.5rem; }
  li { margin: 0.25rem 0; }
`;


// const [sessionId] = useState(() => {
//   const existing = sessionStorage.getItem("chat_session_id");
//   if (existing) return existing;

//   const id = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
//   sessionStorage.setItem("chat_session_id", id);
//   return id;
// });


export default function Chat() {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [file, setFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, isLoading, sendMessage: sendChatMessage, isSending } = useChat();
  const logout = useLogout();

  // Auto-scroll to latest message in chat container
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages, isLoading, isSending]);


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
    { code: "ar", name: "Arabic", flag: "🇸🇦" },
    { code: "hi", name: "Hindi", flag: "🇮🇳" },
  ];

  const embedCode = `<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://widget.voxora.ai/embed.js';
    script.setAttribute('data-website-id', 'your-website-id');
    document.head.appendChild(script);
  })();
</script>`;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      try {
        const result = await uploadPdf(selectedFile);
        toast.success(result.message);
      } catch (error) {
        toast.error('Failed to upload PDF');
      }
    } else {
      toast.error('Please select a PDF file');
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    sendChatMessage(message);
    setMessage("");
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    toast.success("Embed code copied to clipboard!");
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    toast.success(isRecording ? "Recording stopped" : "Recording started");
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Chat Assistant</h1>
          <p className="text-muted-foreground">
            Experience next-generation AI conversations with multilingual support
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up">
          <Card className="glass-card border-primary/20 hover:shadow-glow transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Messages Today</CardTitle>
              <MessageCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">127</div>
              <p className="text-xs text-muted-foreground">Active conversations</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-accent/20 hover:shadow-glow transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              <Zap className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1.2s</div>
              <p className="text-xs text-muted-foreground">Average response</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-success/20 hover:shadow-glow transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
              <Sparkles className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">94%</div>
              <p className="text-xs text-muted-foreground">User satisfaction</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-warning/20 hover:shadow-glow transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
              <Users className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Live conversations</p>
            </CardContent>
          </Card>
        </div>

        {/* Chat Interface */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <Card className="glass-card animate-slide-up border-2 border-gradient-to-r from-purple-200 to-pink-200 shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-lg pb-4">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="flex items-center space-x-2">
                  <MessageCircle className="w-5 h-5 text-purple-600" />
                  <span>Live Chat Preview</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-600 font-medium">Online</span>
                </div>
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

              {/* PDF Upload */}
              <div className="flex items-center space-x-3 p-4 bg-white/70 rounded-xl border-2 border-green-100 mt-4">
                <Upload className="w-4 h-4 text-green-600" />
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="pdf-upload"
                />
                <label htmlFor="pdf-upload" className="flex-1">
                  <Button variant="outline" className="w-full cursor-pointer bg-white border-2 border-green-200 hover:bg-green-50" disabled={isLoading}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload PDF Document
                  </Button>
                </label>
                {file && <span className="text-xs text-green-600">{file.name}</span>}
              </div>
            </CardHeader>
            
           <CardContent className="p-0">
  {/* Remove the gradient background from container */}
  <div ref={messagesEndRef} className="h-96 bg-white p-6 overflow-y-auto space-y-4">
    {messages.map((msg) => (
      <div key={msg.id} className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-lg transform transition-all duration-300 hover:scale-105 ${
          msg.isUser
            ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-blue-200"
            : "bg-white border-2 border-gray-100 text-gray-800 shadow-gray-200"
        }`}>
          <div className={`text-sm ${msg.isUser ? "" : "leading-relaxed"}`}>
            {msg.isUser ? (
              msg.text
            ) : (
              <div className="space-y-1.5">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p className="mb-1.5 last:mb-0">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 mb-1.5 space-y-0.5">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 mb-1.5 space-y-0.5">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="mb-0.5">{children}</li>
                    ),
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5 text-right">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>
    ))}
    {(isLoading || isSending) && (
      <div className="flex justify-start">
        <div className="bg-white border-2 border-gray-100 text-gray-800 shadow-gray-200 rounded-2xl px-4 py-3">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="text-sm">Processing...</span>
          </div>
        </div>
      </div>
    )}
  </div>

  {/* ADD THIS INPUT SECTION BACK */}
  <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-t-2 border-gray-100">
    <div className="flex space-x-3">
      <div className="flex-1 relative">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask about your documents or database..."
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          className="pr-12 border-2 border-blue-200 focus:border-purple-400 bg-white shadow-lg rounded-xl"
          disabled={isLoading || isSending}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleRecording}
          className={`absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full ${
            isRecording 
              ? "text-red-500 bg-red-50 hover:bg-red-100" 
              : "text-blue-500 bg-blue-50 hover:bg-blue-100"
          }`}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
      </div>
      <Button 
        onClick={handleSendMessage}
        disabled={isLoading || isSending || !message.trim()}
        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 rounded-xl px-6"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  </div>
</CardContent>
          </Card>

          <Card className="glass-card animate-scale-in border-2 border-gradient-to-r from-green-200 to-teal-200 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 rounded-t-lg">
              <CardTitle className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-green-600" />
                <span>Website Integration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-4 border-2 border-gray-100">
                <h4 className="font-medium mb-3 flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>Widget Preview</span>
                </h4>
                <div className="bg-white rounded-xl border-2 border-gray-200 p-4 min-h-[200px] relative shadow-lg">
                  <div className="absolute bottom-4 right-4 w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-xl animate-bounce">
                    <MessageCircle className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-xs text-muted-foreground">Your website content...</p>
                  <div className="mt-4 space-y-2">
                    <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-2 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3 text-gray-800">Embed Code</h4>
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-4 text-xs font-mono border-2 border-gray-300 shadow-lg">
                  <code className="text-green-400 break-all">{embedCode}</code>
                </div>
                <Button 
                  onClick={handleCopyEmbed}
                  className="w-full mt-3 bg-gradient-to-r from-green-500 to-teal-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 rounded-xl"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Embed Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Installation Guide */}
        <Card className="glass-card animate-scale-in delay-200">
          <CardHeader>
            <CardTitle>Installation Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
                <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3">1</div>
                <h4 className="font-medium text-blue-700 mb-2">Copy Code</h4>
                <p className="text-sm text-blue-600">Copy the embed code from above</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
                <div className="w-12 h-12 bg-purple-500 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3">2</div>
                <h4 className="font-medium text-purple-700 mb-2">Paste Code</h4>
                <p className="text-sm text-purple-600">Add before closing &lt;/body&gt; tag</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
                <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3">3</div>
                <h4 className="font-medium text-green-700 mb-2">Configure</h4>
                <p className="text-sm text-green-600">Replace with your website ID</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-200">
                <div className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3">4</div>
                <h4 className="font-medium text-orange-700 mb-2">Go Live</h4>
                <p className="text-sm text-orange-600">Save and publish your website</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
