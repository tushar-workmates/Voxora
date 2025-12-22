import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Mic, 
  MessageCircle, 
  Brain, 
  Zap,
  ChevronRight,
  Phone,
  Database,
  Globe
} from "lucide-react";
import voxoraLogo from "@/assets/voxora-logo.png";

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 border-b border-border/50 glass-card border-l-0 border-r-0 border-t-0 rounded-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src={voxoraLogo} alt="Voxora" className="w-10 h-10" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Voxora
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/login">
              <Button variant="ghost" className="hover:bg-primary/10">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button className="gradient-primary text-primary-foreground shadow-glow hover:shadow-lg transition-all">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Your Intelligent
              <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Voice & Chat AI Assistant
              </span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Transform your customer interactions with AI-powered voice calls, intelligent chat support, 
              and seamless knowledge base integration. Scale your business with conversational AI.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <Link to="/register">
                <Button size="lg" className="gradient-primary text-primary-foreground shadow-glow hover:shadow-lg transition-all transform hover:scale-105 px-8 py-4">
                  Start Free Trial
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary/10 px-8 py-4">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-slide-up">
            <h3 className="text-3xl font-bold mb-4">Powerful AI Features</h3>
            <p className="text-muted-foreground text-lg">
              Everything you need to automate and enhance customer interactions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="glass-card border-primary/20 hover:shadow-glow transition-all duration-300 transform hover:scale-105 animate-scale-in">
              <CardHeader className="text-center">
                <Mic className="w-12 h-12 mx-auto mb-4 text-primary" />
                <CardTitle>Voice Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center">
                  AI-powered voice calls with natural conversation and real-time transcription
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card border-accent/20 hover:shadow-glow transition-all duration-300 transform hover:scale-105 animate-scale-in delay-100">
              <CardHeader className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-accent" />
                <CardTitle>Smart Chat</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center">
                  Intelligent chat widget for your website with multilingual support
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card border-success/20 hover:shadow-glow transition-all duration-300 transform hover:scale-105 animate-scale-in delay-200">
              <CardHeader className="text-center">
                <Brain className="w-12 h-12 mx-auto mb-4 text-success" />
                <CardTitle>Knowledge Base</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center">
                  Upload documents and PDFs to train your AI with company knowledge
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card border-warning/20 hover:shadow-glow transition-all duration-300 transform hover:scale-105 animate-scale-in delay-300">
              <CardHeader className="text-center">
                <Database className="w-12 h-12 mx-auto mb-4 text-warning" />
                <CardTitle>Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center">
                  Deep insights and transcripts from all customer interactions
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="glass-card border-primary/20 p-12 animate-glow">
            <h3 className="text-3xl font-bold mb-4">
              Ready to Transform Your Customer Experience?
            </h3>
            <p className="text-muted-foreground text-lg mb-8">
              Join thousands of businesses using Voxora to automate support and boost customer satisfaction
            </p>
            <Link to="/register">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-glow hover:shadow-lg transition-all transform hover:scale-105 px-12 py-4">
                Get Started Now
                <Zap className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img src={voxoraLogo} alt="Voxora" className="w-8 h-8" />
            <span className="font-bold text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Voxora
            </span>
          </div>
          <p className="text-muted-foreground">
            © 2024 Voxora. Your Intelligent Voice & Chat AI Assistant.
          </p>
        </div>
      </footer>
    </div>
  );
}
