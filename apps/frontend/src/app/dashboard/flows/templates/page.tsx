"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Workflow, Shield, Users, Zap, MessageSquare, Bot, Bell, LogOut,
  MousePointerClick, Globe, Loader2,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, typeof Workflow> = {
  basics: MessageSquare,
  community: Users,
  moderation: Shield,
  automation: Zap,
};

const PLATFORM_LABELS: Record<string, string> = {
  telegram: "Telegram",
  discord: "Discord",
};

type FlowTemplateSummary = {
  id: string;
  name: string;
  description: string;
  category: string;
  platform: string;
  nodeCount: number;
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<FlowTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    api.getFlowTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const handleUseTemplate = async (templateId: string) => {
    setCreating(templateId);
    try {
      const flow = await api.createFlowFromTemplate(templateId);
      router.push(`/dashboard/flows/${flow.id}/edit`);
    } catch {
      setCreating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Flow Templates</h1>
        <p className="text-muted-foreground mt-1">
          Start with a pre-built template and customize it
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => {
          const Icon = CATEGORY_ICONS[template.category] ?? Workflow;
          return (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <div className="mt-1 flex gap-1">
                      <Badge variant="secondary">{template.category}</Badge>
                      <Badge variant="outline">{PLATFORM_LABELS[template.platform] ?? template.platform}</Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between">
                <CardDescription className="mb-4">{template.description}</CardDescription>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{template.nodeCount} nodes</span>
                  <Button
                    size="sm"
                    disabled={creating !== null}
                    onClick={() => handleUseTemplate(template.id)}
                  >
                    {creating === template.id ? (
                      <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Creating...</>
                    ) : (
                      "Use Template"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
