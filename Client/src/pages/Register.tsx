import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { register } from "@/services/api";

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    companyWebsite: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setIsLoading(true);

    try {
      const result = await register(formData.email, formData.password, formData.companyWebsite);
      if (result.success) {
        toast.success("Account created successfully! Welcome to Voxora!");
        // Store user data
        localStorage.setItem('user', JSON.stringify(result.data.user));
        if (result.data.token) {
          localStorage.setItem('token', result.data.token);
        }
        navigate("/dashboard");
      } else {
        toast.error(result.message || "Registration failed");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start your AI-powered journey with Voxora"
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

        <FormField
          id="companyWebsite"
          name="companyWebsite"
          type="url"
          label="Company Website"
          placeholder="https://yourcompany.com"
          value={formData.companyWebsite}
          onChange={handleInputChange}
          required
        />

        <div className="relative">
          <FormField
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            label="Password"
            placeholder="Create a strong password"
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

        <div className="relative">
          <FormField
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            label="Confirm Password"
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-9 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <Button 
          type="submit" 
          className="w-full gradient-primary text-primary-foreground shadow-glow hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]"
          disabled={isLoading}
        >
          {isLoading ? "Creating account..." : "Create Account"}
        </Button>

        <div className="text-center">
          <div className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link 
              to="/login" 
              className="text-primary hover:text-accent font-medium transition-colors"
            >
              Sign in here
            </Link>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}