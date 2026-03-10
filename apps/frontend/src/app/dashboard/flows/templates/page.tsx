"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Workflow, Shield, Users, Zap } from "lucide-react";

const TEMPLATES = [
  {
    id: "welcome-flow",
    name: "Welcome New Members",
    description: "Send a welcome message when a user joins the group",
    category: "community",
    icon: Users,
    nodeCount: 2,
  },
  {
    id: "spam-escalation",
    name: "Spam Escalation",
    description: "Detect spam keywords and escalate with mute/ban",
    category: "moderation",
    icon: Shield,
    nodeCount: 3,
  },
  {
    id: "broadcast-flow",
    name: "Scheduled Broadcast",
    description: "Send a message on a schedule to multiple groups",
    category: "automation",
    icon: Zap,
    nodeCount: 2,
  },
  {
    id: "cross-post-flow",
    name: "Cross-Post Messages",
    description: "Forward messages between groups",
    category: "automation",
    icon: Workflow,
    nodeCount: 3,
  },
];

export default function TemplatesPage() {
  const router = useRouter();

  const handleUseTemplate = async (templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const flow = await api.createFlow({
      name: template.name,
      description: template.description,
    });

    router.push(`/dashboard/flows/${flow.id}/edit`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Flow Templates</h1>
        <p className="text-muted-foreground mt-1">Start with a pre-built template and customize it</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1">{template.category}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between">
                <CardDescription className="mb-4">{template.description}</CardDescription>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{template.nodeCount} nodes</span>
                  <Button size="sm" onClick={() => handleUseTemplate(template.id)}>
                    Use Template
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
