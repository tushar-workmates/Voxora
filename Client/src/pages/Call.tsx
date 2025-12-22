import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, PhoneCall, Delete, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { makeCall, getTranscriptWebSocketUrl } from "@/services/api";

export default function Call() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isDialing, setIsDialing] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'connected' | 'completed'>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [transcriptCount, setTranscriptCount] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);

  const dialPadNumbers = [
    ['1', '2', '3'],
    ['4', '5', '6'], 
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

  // WebSocket connection for real-time updates
  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    const ws = new WebSocket(getTranscriptWebSocketUrl());
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected for call tracking');
      setIsConnected(true);
      wsRef.current = ws;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'transcript_update' && data.callType === 'outbound' && data.requestUuid === callId) {
          setTranscriptCount(prev => prev + 1);
          toast.success("Transcript updated", { description: "New conversation recorded" });
        }
        
        if (data.type === 'summary' && data.callType === 'outbound' && data.requestUuid === callId) {
          toast.success("Call completed", { description: "Summary generated and transcript saved" });
          setCallStatus('completed');
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
  };

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleNumberClick = (number: string) => {
    if (phoneNumber.length < 15) {
      setPhoneNumber(prev => prev + number);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleCall = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    setIsDialing(true);
    setCallStatus('dialing');
    setTranscriptCount(0);
    
    try {
      const result = await makeCall(phoneNumber);
      
      // Check if call was successful (backend might return different success indicators)
      if (result && (result.success || result.status === 'success' || result.call_sid || result.sid)) {
        const requestUuid = result.requestUuid || result.callId || result.call_sid || result.sid || `call_${Date.now()}`;
        setCallId(requestUuid);
        setCallStatus('connected');
        
        toast.success(`Call initiated to ${phoneNumber}`, { 
          description: `Call ID: ${requestUuid.toString().slice(-8)}` 
        });
        
        // Connect WebSocket if not already connected
        if (!isConnected) {
          connectWebSocket();
        }
      } else {
        toast.error(result?.error || result?.message || "Failed to make call");
        setCallStatus('idle');
      }
    } catch (error: any) {
      console.error("Call error:", error);
      // If call actually went through but API returned error, still show success
      if (error?.response?.status === 200 || error?.response?.data?.call_sid) {
        const requestUuid = error.response.data.call_sid || `call_${Date.now()}`;
        setCallId(requestUuid);
        setCallStatus('connected');
        toast.success(`Call initiated to ${phoneNumber}`, { 
          description: `Call ID: ${requestUuid.toString().slice(-8)}` 
        });
      } else {
        toast.error(error?.response?.data?.error || error.message || "Failed to make call");
        setCallStatus('idle');
      }
    } finally {
      setIsDialing(false);
    }
  };

  const resetCall = () => {
    setPhoneNumber("");
    setCallId(null);
    setCallStatus('idle');
    setTranscriptCount(0);
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Outbound Call</h1>
          <p className="text-muted-foreground">Make calls with automatic transcript recording</p>
          <div className="flex items-center justify-center mt-2 space-x-2">
            {isConnected ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-red-600" />}
            <span className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Call Status */}
        {callStatus !== 'idle' && (
          <Card className="glass-card mb-6">
            <CardContent className="p-4">
              <div className="text-center">
                <div className={`text-lg font-semibold ${
                  callStatus === 'dialing' ? 'text-yellow-600' :
                  callStatus === 'connected' ? 'text-green-600' :
                  'text-blue-600'
                }`}>
                  {callStatus === 'dialing' ? 'Dialing...' :
                   callStatus === 'connected' ? 'Call Active' :
                   'Call Completed'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {callId && `Call ID: ${callId.slice(-8)}`}
                </div>
                {transcriptCount > 0 && (
                  <div className="text-sm text-green-600 mt-1">
                    {transcriptCount} transcript updates received
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center">
              <Phone className="w-5 h-5 mr-2" />
              Dial Pad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Phone Number Display */}
            <div className="text-center">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+*#]/g, ''))}
                placeholder="Enter number"
                className="w-full bg-gray-50 rounded-lg p-4 text-2xl font-mono tracking-wider text-center border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                maxLength={15}
              />
            </div>

            {/* Dial Pad */}
            <div className="grid grid-cols-3 gap-3">
              {dialPadNumbers.flat().map((number) => (
                <Button
                  key={number}
                  variant="outline"
                  size="lg"
                  className="h-16 text-xl font-semibold hover:bg-blue-50"
                  onClick={() => handleNumberClick(number)}
                  disabled={callStatus === 'dialing'}
                >
                  {number}
                </Button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={handleBackspace}
                disabled={!phoneNumber || callStatus === 'dialing'}
              >
                <Delete className="w-5 h-5" />
              </Button>
              
              {callStatus === 'idle' ? (
                <Button
                  size="lg"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleCall}
                  disabled={isDialing || !phoneNumber}
                >
                  <PhoneCall className="w-5 h-5 mr-2" />
                  {isDialing ? "Calling..." : "Call"}
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1"
                  onClick={resetCall}
                >
                  New Call
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
