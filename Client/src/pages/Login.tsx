import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { login } from "@/services/api";

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      if (result.success) {
        console.log('Login result:', result); // Debug log
        toast.success("Welcome back to Voxora!");
        // Store user data if needed
        // localStorage.setItem('user', JSON.stringify(result.data.user));
        if (result.data.token) {
          // console.log('Storing token:', result.data.token); // Debug log
          localStorage.setItem('token', result.data.token);
        } else {
          console.log('No token in login response!'); // Debug log
        }
        navigate("/dashboard");
      } else {
        toast.error(result.message || "Login failed");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Voxora dashboard"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormField
          id="email"
          name="email"
          type="email"
          label="Email Address"
          placeholder="your@company.com"
          value={formData.email}
          onChange={handleInputChange}
          required
        />

        <div className="relative">
          <FormField
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            label="Password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleInputChange}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-9 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <Button 
          type="submit" 
          className="w-full gradient-primary text-primary-foreground shadow-glow hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]"
          disabled={isLoading}
        >
          {isLoading ? "Signing in..." : "Sign in to Dashboard"}
        </Button>

        <div className="text-center space-y-3">
          <Link 
            to="/forgot-password" 
            className="text-sm text-primary hover:text-accent transition-colors"
          >
            Forgot your password?
          </Link>
          
          <div className="text-sm text-muted-foreground">
            New to Voxora?{" "}
            <Link 
              to="/register" 
              className="text-primary hover:text-accent font-medium transition-colors"
            >
              Create your account
            </Link>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}