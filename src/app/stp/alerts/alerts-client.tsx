"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AlertItem } from "./actions";
import { acknowledgeAlert, removeAcknowledgment } from "./actions";

type TabValue = "all" | "unhandled" | "handled";

export function AlertsClient({ alerts }: { alerts: AlertItem[] }) {
  const [activeTab, setActiveTab] = useState<TabValue>("all");

  const counts = useMemo(
    () => ({
      all: alerts.length,
      unhandled: alerts.filter((a) => !a.isAcknowledged).length,
      handled: alerts.filter((a) => a.isAcknowledged).length,
    }),
    [alerts]
  );

  const filteredAlerts = useMemo(() => {
    if (activeTab === "unhandled")
      return alerts.filter((a) => !a.isAcknowledged);
    if (activeTab === "handled") return alerts.filter((a) => a.isAcknowledged);
    return alerts;
  }, [alerts, activeTab]);

  const urgentAlerts = filteredAlerts.filter((a) => a.severity === "urgent");
  const warningAlerts = filteredAlerts.filter((a) => a.severity === "warning");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold">アラート検知</h1>
        {counts.unhandled > 0 && (
          <Badge variant="destructive" className="text-sm">
            {counts.unhandled}件 未対応
          </Badge>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <TabsList>
          <TabsTrigger value="all">
            全て
            <Badge variant="secondary" className="ml-1.5">
              {counts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unhandled">
            未対応
            <Badge
              variant={counts.unhandled > 0 ? "destructive" : "secondary"}
              className="ml-1.5"
            >
              {counts.unhandled}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="handled">
            対応済み
            <Badge variant="secondary" className="ml-1.5">
              {counts.handled}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {activeTab === "all"
              ? "現在アラートはありません"
              : activeTab === "unhandled"
                ? "未対応のアラートはありません"
                : "対応済みのアラートはありません"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {urgentAlerts.length > 0 && (
            <AlertSection
              title="緊急"
              alerts={urgentAlerts}
              severity="urgent"
            />
          )}
          {warningAlerts.length > 0 && (
            <AlertSection
              title="注意"
              alerts={warningAlerts}
              severity="warning"
            />
          )}
        </div>
      )}
    </div>
  );
}

function AlertSection({
  title,
  alerts,
  severity,
}: {
  title: string;
  alerts: AlertItem[];
  severity: "urgent" | "warning";
}) {
  const colorClass =
    severity === "urgent"
      ? "border-red-500 text-red-700"
      : "border-yellow-500 text-yellow-700";
  const bgClass =
    severity === "urgent" ? "bg-red-50" : "bg-yellow-50";
  const iconColor =
    severity === "urgent" ? "text-red-500" : "text-yellow-500";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className={`h-5 w-5 ${iconColor}`} />
          <span className={severity === "urgent" ? "text-red-700" : "text-yellow-700"}>
            {title}
          </span>
          <Badge
            variant="outline"
            className={`${colorClass} ${bgClass}`}
          >
            {alerts.length}件
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} severity={severity} />
        ))}
      </CardContent>
    </Card>
  );
}

function AlertCard({
  alert,
  severity,
}: {
  alert: AlertItem;
  severity: "urgent" | "warning";
}) {
  const [isPending, startTransition] = useTransition();

  const borderColor =
    severity === "urgent" ? "border-l-red-500" : "border-l-yellow-500";

  const handleAcknowledge = () => {
    startTransition(async () => {
      await acknowledgeAlert(alert.type, alert.id);
    });
  };

  const handleRemoveAcknowledgment = () => {
    startTransition(async () => {
      await removeAcknowledgment(alert.type, alert.id);
    });
  };

  return (
    <div
      className={`border-l-4 ${borderColor} rounded-r-lg border border-l-4 p-4 transition-all ${
        alert.isAcknowledged ? "opacity-50 bg-gray-50" : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm truncate">{alert.title}</h3>
            {alert.isAcknowledged && (
              <Badge
                variant="outline"
                className="text-green-600 border-green-300 bg-green-50 shrink-0"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                対応済み
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600">{alert.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {alert.relatedUrl && (
            <Link href={alert.relatedUrl}>
              <Button variant="ghost" size="sm" className="text-gray-500">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          )}

          {alert.isAcknowledged ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveAcknowledgment}
              disabled={isPending}
              className="text-gray-500"
            >
              取消
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAcknowledge}
              disabled={isPending}
              className="text-green-600 border-green-300 hover:bg-green-50"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              対応済み
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
