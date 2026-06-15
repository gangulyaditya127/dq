import type { ComponentType, ReactNode } from "react";

export function Card({
  icon: Icon,
  title,
  trailing,
  children,
  className = "",
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl bg-gradient-surface border border-border shadow-card overflow-hidden ${className}`}
    >
      <header className="flex items-center gap-3 px-5 py-4 border-b border-border bg-background/20">
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <h2 className="font-semibold text-foreground tracking-tight flex-1">{title}</h2>
        {trailing}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
