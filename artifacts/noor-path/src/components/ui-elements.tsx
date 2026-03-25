import React from "react";
import { cn } from "@/lib/utils";

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline" | "ghost" | "accent", size?: "sm" | "md" | "lg" }>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl font-semibold transition-all duration-200 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
          {
            "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 focus:ring-primary/20": variant === "primary",
            "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary/30": variant === "secondary",
            "border-2 border-border bg-transparent hover:bg-secondary/50 focus:ring-border/50 text-foreground": variant === "outline",
            "bg-transparent hover:bg-secondary/50 text-muted-foreground hover:text-foreground": variant === "ghost",
            "bg-accent text-accent-foreground shadow-lg shadow-accent/25 hover:shadow-xl hover:-translate-y-0.5 focus:ring-accent/20": variant === "accent",
            "px-4 py-2 text-sm": size === "sm",
            "px-6 py-3 text-base": size === "md",
            "px-8 py-4 text-lg": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export const Card = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-card rounded-3xl p-5 shadow-xl shadow-black/5 border border-border/50", className)} {...props}>
    {children}
  </div>
);

export const Badge = ({ children, variant = "default", className }: { children: React.ReactNode, variant?: "default" | "success" | "warning" | "accent", className?: string }) => (
  <span className={cn(
    "px-2.5 py-1 text-xs font-bold rounded-full",
    {
      "bg-primary/10 text-primary": variant === "default",
      "bg-green-500/10 text-green-700": variant === "success",
      "bg-amber-500/10 text-amber-700": variant === "warning",
      "bg-accent/10 text-accent-foreground": variant === "accent",
    },
    className
  )}>
    {children}
  </span>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex w-full rounded-2xl border-2 border-border bg-background/50 px-4 py-3 text-sm transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
