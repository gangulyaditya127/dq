import { Sparkles, FileEdit, RefreshCw, Image as ImageIcon, CheckCircle2, Copy, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "./Card";
import { toast } from "sonner";
import type { AnalysisResult } from "@/lib/incident-api";

const SECTIONS: { key: keyof AnalysisResult; icon: any; title: string }[] = [
  { key: "journals_summary", icon: FileEdit, title: "Journals & Work Notes Summary" },
  { key: "audit_summary", icon: RefreshCw, title: "Audit Trail Summary" },
  { key: "image_analysis", icon: ImageIcon, title: "Image Attachments Analysis" },
];

function Section({
  icon: Icon,
  title,
  content,
}: {
  icon: any;
  title: string;
  content?: string;
}) {
  if (!content) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-raised/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="text-sm text-foreground/90 prose-incident">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function ResolutionBox({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Resolution copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-xl border border-primary/40 bg-gradient-primary/5 p-5 shadow-glow relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-primary opacity-[0.08] pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Recommended Resolution</h3>
          </div>
          <Button size="sm" variant="outline" onClick={copy} className="gap-2">
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="text-sm text-foreground prose-incident">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export function AnalysisPanelCard({
  analysis,
  loading,
}: {
  analysis: AnalysisResult | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card icon={Sparkles} title="AI Analysis & Resolution">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="relative h-16 w-16 mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-primary opacity-30 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-gradient-primary flex items-center justify-center">
              <Brain className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h3 className="text-base font-medium text-foreground mb-1">Analyzing incident…</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Reviewing journals, audit trail, and attachments to draft a resolution recommendation.
          </p>
        </div>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card icon={Sparkles} title="AI Analysis & Resolution">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Brain className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground max-w-sm">
            Fetch an incident to generate journal summaries, audit insights, and a recommended
            resolution note.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      icon={Sparkles}
      title="AI Analysis & Resolution"
      trailing={
        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
          Complete
        </Badge>
      }
    >
      <div className="space-y-4">
        {analysis.recommended_resolution && (
          <ResolutionBox content={analysis.recommended_resolution} />
        )}
        {SECTIONS.map((s) => (
          <Section key={s.key} icon={s.icon} title={s.title} content={analysis[s.key]} />
        ))}
      </div>
    </Card>
  );
}
