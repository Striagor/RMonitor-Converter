"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sidebar, Header } from "@/components/layout";
import { DashboardTab } from "@/components/dashboard";
import { TcpSourcesTab } from "@/components/tcp-sources";
import { WsServersTab } from "@/components/ws-servers";
import { RolesTab } from "@/components/roles";
import { ApiKeysTab, SettingsTab } from "@/components/settings";
import { DatabaseTab } from "@/components/database";

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");

  // Use memo to derive active tab from URL
  const activeTab = useMemo(() => {
    const validTabs = ["dashboard", "tcp", "ws", "roles", "apikeys", "database", "settings"];
    return validTabs.includes(tabParam || "") ? tabParam : "dashboard";
  }, [tabParam]);

  const handleTabChange = (value: string) => {
    if (value === "dashboard") {
      router.push("/", { scroll: false });
    } else {
      router.push(`/?tab=${value}`, { scroll: false });
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-screen">
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col lg:ml-64">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <TabsList className="mb-4 hidden">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="tcp">TCP Sources</TabsTrigger>
              <TabsTrigger value="ws">WS/WSS Servers</TabsTrigger>
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="apikeys">API Keys</TabsTrigger>
              <TabsTrigger value="database">Database</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-0">
              <DashboardTab />
            </TabsContent>

            <TabsContent value="tcp" className="mt-0">
              <TcpSourcesTab />
            </TabsContent>

            <TabsContent value="ws" className="mt-0">
              <WsServersTab />
            </TabsContent>

            <TabsContent value="roles" className="mt-0">
              <RolesTab />
            </TabsContent>

            <TabsContent value="apikeys" className="mt-0">
              <ApiKeysTab />
            </TabsContent>

            <TabsContent value="database" className="mt-0">
              <DatabaseTab />
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <SettingsTab />
            </TabsContent>
          </main>
        </div>
      </div>
    </Tabs>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">Loading...</div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
