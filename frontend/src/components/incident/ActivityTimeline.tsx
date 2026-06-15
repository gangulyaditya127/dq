import { History, MessageSquare, FileEdit, Paperclip, RefreshCw, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "./Card";
import type { ActivityItem } from "@/lib/incident-api";

const TYPE_CONFIG: Record<
  string,
  { icon: any; label: string; cls: string; dot: string }
> = {
  work_note: {
    icon: FileEdit,
    label: "Work Note",
    cls: "bg-primary/10 text-primary border-primary/30",
    dot: "bg-primary",
  },
  comment: {
    icon: MessageSquare,
    label: "Comment",
    cls: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
  },
  attachment: {
    icon: Paperclip,
    label: "Attachment",
    cls: "bg-accent/10 text-accent-foreground border-border",
    dot: "bg-accent",
  },
  field_change: {
    icon: RefreshCw,
    label: "Field Change",
    cls: "bg-warning/10 text-warning border-warning/30",
    dot: "bg-warning",
  },
};

function Item({ item }: { item: ActivityItem }) {
  const cfg = TYPE_CONFIG[item.type || "work_note"] || TYPE_CONFIG.work_note;
  const Icon = cfg.icon;
  const ts = item.created_on || item.sys_created_on;
  const by = item.created_by || item.sys_created_by;

  return (
    <li className="relative pl-8 pb-5">
      <span className={`absolute left-2 top-2 h-3 w-3 rounded-full ${cfg.dot} ring-4 ring-background`} />
      <div className="rounded-lg border border-border bg-surface-raised/60 p-3">
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-1">
          <Badge variant="outline" className={`gap-1 ${cfg.cls}`}>
            <Icon className="h-3 w-3" />
            {cfg.label}
          </Badge>
          {ts && <span>{ts}</span>}
          {by && (
            <span>
              by <span className="text-foreground/80">{by}</span>
            </span>
          )}
        </div>
        {item.type === "attachment" ? (
          <div className="text-sm">
            <span className="font-medium text-foreground">{item.file_name || "Attachment"}</span>
            {item.content_type && (
              <span className="text-xs text-muted-foreground ml-2">{item.content_type}</span>
            )}
          </div>
        ) : item.type === "field_change" ? (
          <div className="text-sm flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{item.field || "Field"}:</span>
            <span className="text-muted-foreground line-through">
              {item.old_value || "(empty)"}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="text-foreground">{item.new_value || "(empty)"}</span>
          </div>
        ) : (
          <div
            className="text-sm text-foreground/90 prose-incident"
            dangerouslySetInnerHTML={{ __html: item.value || item.text || item.content || "" }}
          />
        )}
      </div>
    </li>
  );
}

export function ActivityTimelineCard({
  activity,
  loading,
}: {
  activity: ActivityItem[] | { activities: ActivityItem[] } | null;
  loading: boolean;
}) {
  const list: ActivityItem[] = Array.isArray(activity)
    ? activity
    : activity?.activities || [];

  return (
    <Card
      icon={History}
      title="Activity Timeline"
      trailing={
        list.length > 0 && (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            {list.length}
          </Badge>
        )
      }
    >
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-surface-raised" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No activity records yet</p>
        </div>
      ) : (
        <ol className="relative border-l border-border ml-3 max-h-[600px] overflow-y-auto scrollbar-thin pr-2">
          {list.map((item, idx) => (
            <Item key={item.sys_id || idx} item={item} />
          ))}
        </ol>
      )}
    </Card>
  );
}
