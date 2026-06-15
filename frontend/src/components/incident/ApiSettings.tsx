import { useEffect, useState } from "react";
import { Settings2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiBaseUrl, setApiBaseUrl, pingBackend } from "@/lib/incident-api";
import { toast } from "sonner";

export function ApiSettings({ onChange }: { onChange?: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<"ok" | "fail" | null>(null);

  useEffect(() => {
    if (open) {
      setValue(getApiBaseUrl());
      setResult(null);
    }
  }, [open]);

  const handleTest = async () => {
    setApiBaseUrl(value);
    setTesting(true);
    setResult(null);
    const ok = await pingBackend();
    setResult(ok ? "ok" : "fail");
    setTesting(false);
  };

  const handleSave = () => {
    setApiBaseUrl(value);
    toast.success("API URL saved");
    onChange?.();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          API Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-surface border-border">
        <DialogHeader>
          <DialogTitle>Backend API URL</DialogTitle>
          <DialogDescription>
            This UI runs in the Lovable cloud, so <code className="text-primary">localhost</code> only
            works if you load the preview on the same machine running Flask. Otherwise expose your
            backend with a tunnel (e.g. <code className="text-primary">ngrok http 5000</code>) and
            paste the public URL here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label htmlFor="api-url">Base URL</Label>
          <Input
            id="api-url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://your-tunnel.ngrok.app"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            The client will call <code>{value || "<base>"}/api/recommend_resolution</code>.
          </p>
          {result === "ok" && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Backend reachable
            </div>
          )}
          {result === "fail" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" /> Could not reach /api/health
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing || !value.trim()}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test connection"}
          </Button>
          <Button onClick={handleSave} className="bg-gradient-primary text-primary-foreground">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
