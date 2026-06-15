import { FileText, AlertCircle, User, Users, Clock, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "./Card";
import type { IncidentDetails as Inc } from "@/lib/incident-api";

const PRIORITY_STYLES: Record<string, string> = {
  "1 - Critical": "bg-destructive/15 text-destructive border-destructive/30",
  "2 - High": "bg-warning/15 text-warning border-warning/30",
  "3 - Moderate": "bg-primary/15 text-primary border-primary/30",
  "4 - Low": "bg-success/15 text-success border-success/30",
  "5 - Planning": "bg-muted text-muted-foreground border-border",
};

const STATE_STYLES: Record<string, string> = {
  New: "bg-primary/15 text-primary border-primary/30",
  "In Progress": "bg-warning/15 text-warning border-warning/30",
  "On Hold": "bg-secondary text-secondary-foreground border-border",
  Resolved: "bg-success/15 text-success border-success/30",
  Closed: "bg-muted text-muted-foreground border-border",
  Canceled: "bg-destructive/15 text-destructive border-destructive/30",
};

function Field({ label, value, icon: Icon }: { label: string; value?: string; icon?: any }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm text-foreground truncate">{value || "—"}</div>
      </div>
    </div>
  );
}

export function IncidentDetailsCard({
  incident,
  loading,
}: {
  incident: Inc | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card icon={FileText} title="Incident Details">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-surface-raised" />
          ))}
        </div>
      </Card>
    );
  }

  if (!incident) {
    return (
      <Card icon={FileText} title="Incident Details">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Search an incident number to load details
          </p>
        </div>
      </Card>
    );
  }

  const stateCls = STATE_STYLES[incident.state || ""] || "bg-secondary text-secondary-foreground";
  const prioCls = PRIORITY_STYLES[incident.priority || ""] || "bg-secondary text-secondary-foreground";

  return (
    <Card
      icon={FileText}
      title="Incident Details"
      trailing={
        <Badge variant="outline" className={stateCls}>
          {incident.state || "Unknown"}
        </Badge>
      }
    >
      <div className="space-y-1">
        <div className="pb-3 border-b border-border">
          <div className="text-xs text-muted-foreground font-mono">{incident.number}</div>
          <div className="text-base font-medium text-foreground mt-1">
            {incident.short_description || "Untitled incident"}
          </div>
          {incident.description && (
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-6">
              {incident.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4">
          <div className="flex items-center gap-2 py-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground w-20">
              Priority
            </div>
            <Badge variant="outline" className={prioCls}>
              {incident.priority || "—"}
            </Badge>
          </div>
          <Field label="Urgency" value={incident.urgency} />
          <Field label="Impact" value={incident.impact} />
          <Field label="Category" value={incident.category} />
        </div>

        <div className="border-t border-border pt-2">
          <Field label="Assignment Group" value={incident.assignment_group} icon={Users} />
          <Field label="Assigned To" value={incident.assigned_to} icon={User} />
          <Field label="Opened By" value={incident.opened_by} icon={User} />
          <Field label="Opened At" value={incident.opened_at} icon={Clock} />
        </div>

        {incident.close_notes && (
          <div className="mt-3 rounded-lg border border-success/30 bg-success/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-success mb-2">
              <CheckCircle2 className="h-4 w-4" />
              Resolution Notes
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{incident.close_notes}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
