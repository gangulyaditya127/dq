import { useState } from "react";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EXAMPLES = ["INC0010001", "INC0010002", "INC0010003"];

export function IncidentSearch({
  onSubmit,
  loading,
}: {
  onSubmit: (n: string) => void;
  loading: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  };

  return (
    <div className="relative rounded-2xl bg-gradient-surface border border-border p-6 shadow-card">
      <form
        className="flex flex-col sm:flex-row gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            placeholder="Enter incident number, e.g. INC0010001"
            disabled={loading}
            autoFocus
            className="pl-10 h-12 text-base bg-background/50 border-border focus-visible:ring-primary"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !value.trim()}
          className="h-12 px-6 bg-gradient-primary text-primary-foreground font-medium shadow-glow hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Recommend resolution
            </>
          )}
        </Button>
      </form>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span>Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setValue(ex);
              submit(ex);
            }}
            disabled={loading}
            className="px-2 py-1 rounded-md bg-surface-raised border border-border hover:border-primary hover:text-primary transition-colors font-mono"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
