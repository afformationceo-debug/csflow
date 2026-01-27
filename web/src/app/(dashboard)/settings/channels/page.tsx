"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  MessageCircle,
  Instagram,
  Facebook,
  Phone,
  Plus,
  Trash2,
  Settings2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

// Channel type icons
const CHANNEL_ICONS = {
  line: MessageCircle,
  kakao: MessageCircle,
  facebook: Facebook,
  instagram: Instagram,
  whatsapp: Phone,
} as const;

// Channel display names
const CHANNEL_NAMES = {
  line: "LINE",
  kakao: "카카오톡",
  facebook: "Facebook Messenger",
  instagram: "Instagram DM",
  whatsapp: "WhatsApp Business",
} as const;

// Channel colors
const CHANNEL_COLORS = {
  line: "bg-green-500",
  kakao: "bg-yellow-500",
  facebook: "bg-blue-600",
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  whatsapp: "bg-green-600",
} as const;

interface ConnectedChannel {
  id: string;
  channelType: keyof typeof CHANNEL_ICONS;
  accountId: string;
  accountName: string;
  isActive: boolean;
  createdAt: string;
}

// Mock tenant ID - in production this would come from auth context
const TENANT_ID = "demo-tenant-id";

export default function ChannelsPage() {
  const queryClient = useQueryClient();
  const [connectingMeta, setConnectingMeta] = useState(false);

  // Fetch connected channels
  const { data: channelsData, isLoading } = useQuery({
    queryKey: ["channels", TENANT_ID],
    queryFn: async () => {
      const response = await fetch(`/api/channels?tenantId=${TENANT_ID}`);
      if (!response.ok) throw new Error("Failed to fetch channels");
      return response.json();
    },
  });

  // Toggle channel active status
  const toggleChannel = useMutation({
    mutationFn: async ({
      channelId,
      isActive,
    }: {
      channelId: string;
      isActive: boolean;
    }) => {
      const response = await fetch("/api/channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, settings: { is_active: isActive } }),
      });
      if (!response.ok) throw new Error("Failed to update channel");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", TENANT_ID] });
    },
  });

  // Disconnect channel
  const disconnectChannel = useMutation({
    mutationFn: async ({
      channelType,
      accountId,
    }: {
      channelType: string;
      accountId: string;
    }) => {
      const response = await fetch(
        `/api/channels?tenantId=${TENANT_ID}&channelType=${channelType}&accountId=${accountId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to disconnect channel");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", TENANT_ID] });
    },
  });

  // Start Meta OAuth flow
  const startMetaOAuth = async () => {
    setConnectingMeta(true);
    try {
      const response = await fetch("/api/oauth/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });

      if (!response.ok) throw new Error("Failed to start OAuth");

      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      console.error("Failed to start Meta OAuth:", error);
      setConnectingMeta(false);
    }
  };

  const channels: ConnectedChannel[] = channelsData?.channels || [];

  // Group channels by type
  const channelsByType = channels.reduce(
    (acc, channel) => {
      if (!acc[channel.channelType]) {
        acc[channel.channelType] = [];
      }
      acc[channel.channelType].push(channel);
      return acc;
    },
    {} as Record<string, ConnectedChannel[]>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">채널 관리</h1>
          <p className="text-muted-foreground">
            메신저 채널을 연결하고 관리합니다
          </p>
        </div>
      </div>

      {/* Add Channel Section */}
      <Card>
        <CardHeader>
          <CardTitle>새 채널 연결</CardTitle>
          <CardDescription>
            고객 문의를 받을 메신저 채널을 연결하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Meta Platform (Facebook, Instagram, WhatsApp) */}
            <Card className="border-2 border-dashed hover:border-primary transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <Facebook className="w-5 h-5 text-white" />
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                      <Instagram className="w-5 h-5 text-white" />
                    </div>
                    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Meta Platform</h3>
                    <p className="text-sm text-muted-foreground">
                      Facebook, Instagram, WhatsApp
                    </p>
                  </div>
                  <Button
                    onClick={startMetaOAuth}
                    disabled={connectingMeta}
                    size="sm"
                  >
                    {connectingMeta ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* LINE */}
            <Card className="border-2 border-dashed hover:border-primary transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">LINE</h3>
                    <p className="text-sm text-muted-foreground">
                      LINE Official Account
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    <Settings2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* KakaoTalk */}
            <Card className="border-2 border-dashed hover:border-primary transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">카카오톡</h3>
                    <p className="text-sm text-muted-foreground">
                      카카오 i 오픈빌더
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    <Settings2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Connected Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            연결된 채널
            <Badge variant="secondary">{channels.length}</Badge>
          </CardTitle>
          <CardDescription>현재 연결된 메신저 채널 목록입니다</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              연결된 채널이 없습니다. 위에서 새 채널을 연결하세요.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(channelsByType).map(([type, typeChannels]) => (
                <div key={type} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    {CHANNEL_NAMES[type as keyof typeof CHANNEL_NAMES]}
                    <Badge variant="outline" className="text-xs">
                      {typeChannels.length}
                    </Badge>
                  </h3>
                  <div className="grid gap-2">
                    {typeChannels.map((channel) => {
                      const Icon =
                        CHANNEL_ICONS[
                          channel.channelType as keyof typeof CHANNEL_ICONS
                        ];
                      const bgColor =
                        CHANNEL_COLORS[
                          channel.channelType as keyof typeof CHANNEL_COLORS
                        ];

                      return (
                        <div
                          key={channel.id}
                          className="flex items-center gap-4 p-4 rounded-lg border bg-card"
                        >
                          <div
                            className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}
                          >
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {channel.accountName}
                              </span>
                              {channel.isActive ? (
                                <Badge
                                  variant="default"
                                  className="bg-green-500"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  활성
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  비활성
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              ID: {channel.accountId}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={channel.isActive}
                              onCheckedChange={(checked) =>
                                toggleChannel.mutate({
                                  channelId: channel.id,
                                  isActive: checked,
                                })
                              }
                            />
                            <Button size="icon" variant="ghost">
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    채널 연결 해제
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {channel.accountName} 채널 연결을
                                    해제하시겠습니까? 이 작업은 되돌릴 수
                                    없습니다.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground"
                                    onClick={() =>
                                      disconnectChannel.mutate({
                                        channelType: channel.channelType,
                                        accountId: channel.accountId,
                                      })
                                    }
                                  >
                                    연결 해제
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 채널
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{channels.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              활성 채널
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {channels.filter((c) => c.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              비활성 채널
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {channels.filter((c) => !c.isActive).length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
