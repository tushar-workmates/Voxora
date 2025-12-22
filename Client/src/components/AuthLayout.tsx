import { ReactNode } from "react";
import voxoraLogo from "@/assets/voxora-logo.png";
import authIllustration from "@/assets/auth-illustration.jpg";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex">
      {/* Left side - Visual/Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary to-accent p-12 flex-col justify-center">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse delay-500" />
        </div>

        <div className="relative z-10 text-center text-white">
          <img 
            src={voxoraLogo} 
            alt="Voxora" 
            className="w-20 h-20 mx-auto mb-8 drop-shadow-2xl animate-float"
          />
          <h1 className="text-5xl font-bold mb-4 animate-fade-in">
            Voxora
          </h1>
          <p className="text-xl mb-8 text-white/90 animate-fade-in delay-200">
            Your Intelligent Voice & Chat AI Assistant
          </p>
          
          <div className="relative mb-8 animate-scale-in delay-300">
            <img 
              src={authIllustration} 
              alt="AI Assistant Illustration" 
              className="w-full max-w-md mx-auto rounded-2xl shadow-2xl opacity-90"
            />
          </div>
          
          <div className="space-y-4 animate-fade-in delay-500">
            <div className="flex items-center justify-center space-x-2 text-white/80">
              <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
              <span className="text-sm">Transform customer interactions with AI</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-white/80">
              <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse delay-200"></div>
              <span className="text-sm">24/7 intelligent voice and chat support</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-white/80">
              <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse delay-400"></div>
              <span className="text-sm">Seamless integration with your website</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo for small screens */}
          <div className="lg:hidden text-center mb-8 animate-fade-in">
            <img 
              src={voxoraLogo} 
              alt="Voxora" 
              className="w-16 h-16 mx-auto mb-4 drop-shadow-lg"
            />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Voxora
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your Intelligent Voice & Chat AI Assistant
            </p>
          </div>

          {/* Auth card */}
          <div className="glass-card rounded-2xl p-8 animate-slide-up shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
              <p className="text-muted-foreground mt-2">{subtitle}</p>
            </div>
            {children}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-6 animate-fade-in delay-300">
            © 2024 Voxora. Powered by AI innovation.
          </p>
        </div>
      </div>
    </div>
  );
}