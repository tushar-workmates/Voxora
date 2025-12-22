import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-2">
        <Label htmlFor={props.id} className="text-sm font-medium">
          {label}
        </Label>
        <Input
          ref={ref}
          className={cn(
            "transition-all duration-200",
            "focus:ring-2 focus:ring-primary/20 focus:border-primary",
            "hover:border-primary/50",
            error && "border-destructive focus:ring-destructive/20 focus:border-destructive",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-sm text-destructive animate-fade-in">{error}</p>
        )}
      </div>
    );
  }
);

FormField.displayName = "FormField";

export { FormField };