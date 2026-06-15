import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Zap, X } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { IncidentSearch } from "@/components/incident/IncidentSearch";
import { IncidentDetailsCard } from "@/components/incident/IncidentDetails";
import { ActivityTimelineCard } from "@/components/incident/ActivityTimeline";
import { AnalysisPanelCard } from "@/components/incident/AnalysisPanel";
import { ApiSettings } from "@/components/incident/ApiSettings";
import {
  recommendResolution,
  type IncidentDetails,
  type ActivityItem,
  type AnalysisResult,
} from "@/lib/incident-api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Incident Resolution Recommender" },
      {
        name: "description",
        content:
          "AI-powered analysis and resolution recommendations for ServiceNow incidents.",
      },
      { property: "og:title", content: "Incident Resolution Recommender" },
      {
        property: "og:description",
        content:
          "AI-powered analysis and resolution recommendations for ServiceNow incidents.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [incident, setIncident] = useState<IncidentDetails | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | { activities: ActivityItem[] } | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (n: string) => {
    setError(null);
    setIncident(null);
    setActivity(null);
    setAnalysis(null);
    setLoading(true);
    try {
      const data = await recommendResolution(n);
      setIncident(data.incident_details);
      setActivity(data.activity);
      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Toaster theme="dark" position="top-right" />

      <header className="border-b border-border bg-background/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">
                Incident Resolution Recommender
              </h1>
              <p className="text-xs text-muted-foreground">
                AI-assisted ServiceNow triage
              </p>
            </div>
          </div>
          <ApiSettings />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <IncidentSearch onSubmit={handleSubmit} loading={loading} />

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-foreground/90 whitespace-pre-wrap">{error}</div>
            <button
              onClick={() => setError(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <IncidentDetailsCard incident={incident} loading={loading && !incident} />
            <ActivityTimelineCard activity={activity} loading={loading && !activity} />
          </div>
          <div className="lg:col-span-3">
            <AnalysisPanelCard analysis={analysis} loading={loading} />
          </div>
        </div>

        <footer className="pt-8 pb-4 text-center text-xs text-muted-foreground">
          Built with TanStack Start · Connects to your Flask backend ·{" "}
          <span className="text-foreground/70">Configure URL in API Settings</span>
        </footer>
      </main>
    </div>
  );
}
