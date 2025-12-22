import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  getOutboundTranscripts,
  getOutboundTranscript,
  makeCall,
  getTranscriptWebSocketUrl 
} from "@/services/api";
import { 
  Eye, 
  PhoneOutgoing, 
  Clock, 
  TrendingUp,
  Calendar,
  User,
  Brain,
  Download,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle
} from "lucide-react";

interface TranscriptMessage {
  type: 'user' | 'ai' | 'function';
  text: string;
  timestamp: number;
  istTime: string;
}

interface CallTranscript {
  requestUuid: string;
  phoneNumber: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  conversationCount: number;
  lastUpdated: number;
  conversation?: TranscriptMessage[];
  summary?: {
    text: string;
    style: string;
    generatedAt: number;
    generatedAtIST: string;
    model: string;
  } | string;
  hasSummary?: boolean;
  callType: 'inbound' | 'outbound';
}

export default function OutboundTranscripts() {
  const [transcripts, setTranscripts] = useState<CallTranscript[]>([]);
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedTranscript, setSelectedTranscript] = useState<CallTranscript | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [makingCall, setMakingCall] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load outbound transcripts
  const loadTranscripts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await getOutboundTranscripts();
      
      if (response && response.success && response.transcripts && Array.isArray(response.transcripts)) {
        const processedTranscripts = response.transcripts.map((transcript: any) => ({
          requestUuid: transcript.requestUuid || `outbound_${Date.now()}_${Math.random()}`,
          phoneNumber: transcript.phoneNumber || 'Unknown',
          startTime: transcript.startTime || Date.now(),
          endTime: transcript.endTime || null,
          duration: transcript.duration || null,
          conversationCount: transcript.conversationCount || 0,
          lastUpdated: transcript.lastUpdated || transcript.createdAt || Date.now(),
          conversation: transcript.conversation || [],
          summary: transcript.summary || null,
          hasSummary: !!transcript.summary,
          callType: 'outbound'
        }));
        
        setTranscripts(processedTranscripts);
      } else {
        setError('Invalid response from server');
        setTranscripts([]);
      }
    } catch (error) {
      console.error('Error loading outbound transcripts:', error);
      setError('Failed to load outbound transcripts');
      setTranscripts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh transcripts
  const refreshTranscripts = async () => {
    try {
      setIsRefreshing(true);
      await loadTranscripts();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load detailed transcript
  const loadDetailedTranscript = async (requestUuid: string) => {
    try {
      const response = await getOutboundTranscript(requestUuid);
      
      if (response.success) {
        const detailedTranscript: CallTranscript = {
          requestUuid: response.requestUuid || requestUuid,
          phoneNumber: response.phoneNumber || 'Unknown',
          startTime: response.startTime,
          endTime: response.endTime,
          duration: response.duration,
          conversationCount: response.conversation?.length || 0,
          lastUpdated: response.endTime || response.startTime,
          conversation: response.conversation || [],
          summary: response.summary || null,
          hasSummary: !!response.summary,
          callType: 'outbound'
        };
        
        setSelectedTranscript(detailedTranscript);
      } else {
        setError(`Failed to load transcript: ${response.error}`);
      }
    } catch (error) {
      console.error('Error loading detailed transcript:', error);
      setError('Failed to load transcript details');
    }
  };

  // Make a call
  const handleMakeCall = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    setMakingCall(true);
    setError(null);

    try {
      await makeCall(phoneNumber);
      console.log('Call initiated to:', phoneNumber);
      
      // Refresh transcripts after a short delay
      setTimeout(() => {
        refreshTranscripts();
      }, 2000);
      
      // Clear phone number
      setPhoneNumber('');
      
    } catch (error: any) {
      console.error('Error making call:', error);
      setError(`Failed to make call: ${error.response?.data?.error || error.message}`);
    } finally {
      setMakingCall(false);
    }
  };

  // WebSocket connection for real-time updates
  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionStatus('connecting');
    
    const ws = new WebSocket(getTranscriptWebSocketUrl());
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected for outbound transcripts');
      setIsConnected(true);
      setConnectionStatus('connected');
      wsRef.current = ws;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'transcript_update') {
          const updateRequestUuid = data.requestUuid || data.callSid;
          
          // Only process if it's an outbound call
          if (data.callType === 'outbound') {
            setTranscripts(prev => prev.map(transcript => {
              if (transcript.requestUuid === updateRequestUuid) {
                return {
                  ...transcript,
                  conversation: [...(transcript.conversation || []), data.entry],
                  conversationCount: (transcript.conversationCount || 0) + 1
                };
              }
              return transcript;
            }));
            
            setSelectedTranscript(prev => {
              if (prev?.requestUuid === updateRequestUuid) {
                return {
                  ...prev,
                  conversation: [...(prev.conversation || []), data.entry],
                  conversationCount: (prev.conversationCount || 0) + 1
                };
              }
              return prev;
            });
          }
        }
        
        if (data.type === 'summary' && data.callType === 'outbound') {
          const summaryRequestUuid = data.requestUuid || data.callSid;
          
          setTranscripts(prev => prev.map(transcript => {
            if (transcript.requestUuid === summaryRequestUuid) {
              return {
                ...transcript,
                summary: {
                  text: data.text,
                  style: 'auto-generated',
                  generatedAt: Date.now(),
                  generatedAtIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                  model: "gpt-3.5-turbo"
                },
                hasSummary: true
              };
            }
            return transcript;
          }));
          
          setSelectedTranscript(prev => {
            if (prev?.requestUuid === summaryRequestUuid) {
              return {
                ...prev,
                summary: {
                  text: data.text,
                  style: 'auto-generated',
                  generatedAt: Date.now(),
                  generatedAtIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                  model: "gpt-3.5-turbo"
                },
                hasSummary: true
              };
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      wsRef.current = null;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };
  };

  useEffect(() => {
    loadTranscripts();
    connectWebSocket();
    
    const interval = setInterval(refreshTranscripts, 30000);
    
    return () => {
      clearInterval(interval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSummaryText = (summary: any) => {
    if (!summary) return null;
    if (typeof summary === 'string') return summary;
    if (summary.text) return summary.text;
    return JSON.stringify(summary);
  };

  const getShortRequestUuid = (requestUuid: string) => {
    if (!requestUuid) return 'Unknown';
    return requestUuid.length > 8 ? requestUuid.slice(-8) : requestUuid;
  };

  // Filter transcripts by phone number
  const filteredTranscripts = transcripts.filter(transcript =>
    transcript.phoneNumber.toLowerCase().includes(searchPhone.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold">Outbound Call Transcripts</h1>
            <div className="flex space-x-2">
              {error && (
                <div className="flex items-center text-amber-600 bg-amber-50 px-3 py-1 rounded-md mr-2">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
              <Button 
                onClick={refreshTranscripts}
                variant="outline"
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                onClick={connectWebSocket}
                variant={isConnected ? "outline" : "default"}
                disabled={connectionStatus === 'connecting'}
              >
                {connectionStatus === 'connecting' ? 'Connecting...' : 
                 isConnected ? 'Reconnect' : 'Connect'}
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            View and manage outbound call transcripts. Make calls and track conversations.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up">
          <Card className="glass-card card-cyan hover:shadow-colorful transition-all duration-300 transform hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-cyan-700">Connection</CardTitle>
              {isConnected ? <Wifi className="h-5 w-5 text-green-600" /> : <WifiOff className="h-5 w-5 text-red-600" />}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${isConnected ? 'text-green-800' : 'text-red-800'}`}>
                {connectionStatus === 'connected' ? 'Connected' : 
                 connectionStatus === 'connecting' ? 'Connecting' : 
                 'Disconnected'}
              </div>
              <p className="text-xs text-cyan-600">
                WebSocket status
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card card-emerald hover:shadow-colorful transition-all duration-300 transform hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700">Total Calls</CardTitle>
              <PhoneOutgoing className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-800">
                {filteredTranscripts.length}
              </div>
              <p className="text-xs text-emerald-600">
                Outbound calls
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card card-violet hover:shadow-colorful transition-all duration-300 transform hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-violet-700">Messages</CardTitle>
              <Brain className="h-5 w-5 text-violet-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-800">
                {transcripts.reduce((total, t) => total + t.conversationCount, 0)}
              </div>
              <p className="text-xs text-violet-600">
                Total exchanges
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card card-rose hover:shadow-colorful transition-all duration-300 transform hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-rose-700">Summaries</CardTitle>
              <TrendingUp className="h-5 w-5 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-800">
                {transcripts.filter(t => t.hasSummary || t.summary).length}
              </div>
              <p className="text-xs text-rose-600">
                Calls with summaries
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transcripts Table */}
        <Card className="glass-card animate-slide-up delay-200">
          <CardHeader>
            <CardTitle>Outbound Call Transcripts</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Click on any transcript to view details and summary
            </p>
            <div className="mt-4">
              <Input
                placeholder="Search by phone number..."
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                className="max-w-md"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-spin" />
                <p className="text-muted-foreground">Loading outbound transcripts...</p>
              </div>
            ) : filteredTranscripts.length === 0 ? (
              <div className="text-center py-8">
                <PhoneOutgoing className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No outbound transcripts found</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Make a call to see transcripts here
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-medium">Request UUID</th>
                      <th className="text-left p-4 font-medium">Phone Number</th>
                      <th className="text-left p-4 font-medium">Start Time</th>
                      <th className="text-left p-4 font-medium">Duration</th>
                      <th className="text-left p-4 font-medium">Messages</th>
                      <th className="text-left p-4 font-medium">Summary</th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTranscripts.map((transcript, index) => (
                      <tr key={transcript.requestUuid || `transcript-${index}`} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="p-4">
                          <div className="font-medium flex items-center space-x-2">
                            <PhoneOutgoing className="w-4 h-4 text-green-500" />
                            <span className="font-mono text-sm">
                              {getShortRequestUuid(transcript.requestUuid)}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>{transcript.phoneNumber}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium text-sm">
                                {formatTimestamp(transcript.startTime)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span>{formatDuration(transcript.duration)}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Brain className="w-4 h-4 text-muted-foreground" />
                            <span className={transcript.conversationCount > 0 ? "font-medium" : "text-muted-foreground"}>
                              {transcript.conversationCount}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center">
                            {transcript.hasSummary || transcript.summary ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                Available
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                                Pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="hover:bg-primary/10 hover:text-primary"
                                onClick={() => transcript.requestUuid && loadDetailedTranscript(transcript.requestUuid)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="flex items-center space-x-2">
                                  <PhoneOutgoing className="w-5 h-5 text-green-500" />
                                  <span>Outbound Call Transcript - {selectedTranscript?.phoneNumber}</span>
                                </DialogTitle>
                              </DialogHeader>
                              
                              {selectedTranscript ? (
                                <div className="space-y-6">
                                  {/* Call Details */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-secondary/20 rounded-lg">
                                    <div>
                                      <div className="text-sm font-medium">Request UUID</div>
                                      <div className="text-sm text-muted-foreground font-mono">
                                        {getShortRequestUuid(selectedTranscript.requestUuid)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium">Phone Number</div>
                                      <div className="text-sm text-muted-foreground">
                                        {selectedTranscript.phoneNumber}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium">Start Time</div>
                                      <div className="text-sm text-muted-foreground">
                                        {formatTimestamp(selectedTranscript.startTime)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium">Duration</div>
                                      <div className="text-sm text-muted-foreground">
                                        {formatDuration(selectedTranscript.duration)}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Transcript */}
                                  <div>
                                    <h4 className="font-semibold mb-3 flex items-center">
                                      Conversation Transcript
                                      <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                        {selectedTranscript.conversationCount} messages
                                      </span>
                                    </h4>
                                    <div className="bg-muted/30 p-4 rounded-lg max-h-96 overflow-y-auto">
                                      {!selectedTranscript.conversation || selectedTranscript.conversation.length === 0 ? (
                                        <p className="text-muted-foreground text-center py-4">
                                          No conversation recorded yet.
                                        </p>
                                      ) : (
                                        <div className="space-y-4">
                                          {selectedTranscript.conversation.map((message, index) => (
                                            <div key={index} className="flex flex-col space-y-1">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    message.type === 'user' ? 'bg-blue-100 text-blue-800' :
                                                    message.type === 'function' ? 'bg-purple-100 text-purple-800' :
                                                    'bg-green-100 text-green-800'
                                                  }`}>
                                                    {message.type === 'user' ? 'Caller' : 
                                                     message.type === 'function' ? 'Function' : 
                                                     'AI Assistant'}
                                                  </span>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                  {message.istTime || formatTimestamp(message.timestamp)}
                                                </span>
                                              </div>
                                              <div className="text-sm pl-4 border-l-2 border-green-200 py-2">
                                                {message.text}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Summary */}
                                  <div>
                                    <h4 className="font-semibold mb-3 flex items-center">
                                      Summary
                                      {selectedTranscript.summary && (
                                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                          Auto-generated
                                        </span>
                                      )}
                                    </h4>
                                    <div className="bg-muted/30 p-4 rounded-lg">
                                      {selectedTranscript.summary ? (
                                        <div>
                                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                                            {formatSummaryText(selectedTranscript.summary)}
                                          </p>
                                          {typeof selectedTranscript.summary === 'object' && selectedTranscript.summary.generatedAtIST && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                              Generated: {selectedTranscript.summary.generatedAtIST}
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="text-center py-4">
                                          <p className="text-muted-foreground mb-2">
                                            Summary will be generated automatically after the call ends
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex justify-end space-x-2 pt-4 border-t">
                                    <Button variant="outline" onClick={() => refreshTranscripts()}>
                                      <RefreshCw className="w-4 h-4 mr-2" />
                                      Refresh
                                    </Button>
                                    <Button variant="outline">
                                      <Download className="w-4 h-4 mr-2" />
                                      Export Transcript
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <p className="text-muted-foreground">Loading transcript details...</p>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}