import { ReactNode, useState, useEffect } from "react";
import { 
  FolderOpen, 
  Phone, 
  MessageCircle, 
  FileText, 
  Database,
  Users,
  Settings,
  LogOut,
  User,
  Calendar
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import voxoraLogo from "@/assets/voxora-logo.png";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { logout, getProfile } from "@/services/api";
import { useGlobalContext } from "@/contexts/GlobalContext";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Knowledge Base", href: "/dashboard", icon: FolderOpen },
  
  { name: "Lead Management", href: "/dashboard/lead-management", icon: Phone },
  { name: "Appointments", href: "/dashboard/appointments", icon: Calendar },
  { name: "Dialer", href: "/dashboard/call", icon: Phone },
  { name: "Chat", href: "/dashboard/chat", icon: MessageCircle },
  { name: "Outbound Transcripts", href: "/dashboard/outbound-transcripts", icon: FileText },
  { name: "Inbound Transcripts", href: "/dashboard/inbound-transcript", icon: FileText },
  { name: "DB Chat", href: "/dashboard/db-chat", icon: Database },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const { dispatch } = useGlobalContext();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate("/login");
          return;
        }
        
        const profileResponse = await getProfile();
        setUser({ email: profileResponse.data.email });
      } catch (error) {
        localStorage.removeItem('token');
        navigate("/login");
      }
    };
    
    loadProfile();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      dispatch({ type: 'LOGOUT' }); // This clears everything including chat messages
      setUser(null);
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Logout failed");
    }
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 glass-card border-r-0 rounded-none min-h-screen">
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center space-x-3">
                <img src={voxoraLogo} alt="Voxora" className="w-8 h-8" />
                <div>
                  <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Voxora
                  </h1>
                  <p className="text-xs text-muted-foreground">AI Assistant</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                      active
                        ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-glow"
                        : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? "text-primary-foreground" : "group-hover:text-primary"}`} />
                    <span className="font-medium">{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-border/50">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start px-3 py-2.5 h-auto">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm">
                          {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <p className="text-sm font-medium">{user?.name || user?.email?.split('@')[0] || 'User'}</p>
                        <p className="text-xs text-muted-foreground">{user?.email || 'user@example.com'}</p>
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem>
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-h-screen">
          <main className="relative z-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}