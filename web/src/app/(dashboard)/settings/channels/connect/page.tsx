"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Facebook,
  Instagram,
  Phone,
  Loader2,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

interface FacebookPage {
  id: string;
  name: string;
  category?: string;
  picture?: {
    data: {
      url: string;
    };
  };
  isConnected: boolean;
}

interface InstagramAccount {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  isConnected: boolean;
}

interface WhatsAppPhone {
  id: string;
  wabaId: string;
  wabaName: string;
  phoneNumber: string;
  verifiedName: string;
  qualityRating: string;
  isConnected: boolean;
}

interface AvailableChannels {
  facebook: FacebookPage[];
  instagram: InstagramAccount[];
  whatsapp: WhatsAppPhone[];
}

function ChannelConnectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");
  const provider = searchParams.get("provider");

  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(
    new Set()
  );
  const [connecting, setConnecting] = useState(false);

  // Fetch available channels
  const {
    data: channelsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["available-channels", sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error("No session");
      const response = await fetch(
        `/api/channels/available?sessionId=${sessionId}`
      );
      if (!response.ok) throw new Error("Failed to fetch channels");
      return response.json();
    },
    enabled: !!sessionId,
  });

  // Connect channel mutation
  const connectChannel = useMutation({
    mutationFn: async ({
      channelType,
      accountId,
    }: {
      channelType: string;
      accountId: string;
    }) => {
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: channelsData?.tenantId,
          channelType,
          sessionId,
          accountId,
        }),
      });
      if (!response.ok) throw new Error("Failed to connect channel");
      return response.json();
    },
  });

  const channels: AvailableChannels = channelsData?.channels || {
    facebook: [],
    instagram: [],
    whatsapp: [],
  };

  const toggleChannel = (channelKey: string) => {
    const newSelected = new Set(selectedChannels);
    if (newSelected.has(channelKey)) {
      newSelected.delete(channelKey);
    } else {
      newSelected.add(channelKey);
    }
    setSelectedChannels(newSelected);
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      for (const channelKey of selectedChannels) {
        const [channelType, accountId] = channelKey.split(":");
        await connectChannel.mutateAsync({ channelType, accountId });
      }
      router.push("/settings/channels?success=true");
    } catch (error) {
      console.error("Failed to connect channels:", error);
      setConnecting(false);
    }
  };

  if (!sessionId || provider !== "meta") {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              유효하지 않은 세션입니다. 다시 연결을 시작해주세요.
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push("/settings/channels")}
            >
              채널 관리로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              연결 가능한 채널을 불러오는 중...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">채널을 불러오는데 실패했습니다.</p>
            <Button
              className="mt-4"
              onClick={() => router.push("/settings/channels")}
            >
              채널 관리로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalAvailable =
    channels.facebook.filter((c) => !c.isConnected).length +
    channels.instagram.filter((c) => !c.isConnected).length +
    channels.whatsapp.filter((c) => !c.isConnected).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/settings/channels")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">채널 연결</h1>
          <p className="text-muted-foreground">
            연결할 채널을 선택하세요 ({totalAvailable}개 연결 가능)
          </p>
        </div>
      </div>

      {/* Facebook Pages */}
      {channels.facebook.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Facebook className="w-5 h-5 text-blue-600" />
              Facebook Pages
              <Badge variant="secondary">{channels.facebook.length}</Badge>
            </CardTitle>
            <CardDescription>
              Facebook Messenger 메시지를 받을 페이지를 선택하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {channels.facebook.map((page) => {
                const channelKey = `facebook:${page.id}`;
                const isSelected = selectedChannels.has(channelKey);

                return (
                  <div
                    key={page.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                      page.isConnected
                        ? "bg-muted opacity-50"
                        : isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                    }`}
                    onClick={() => !page.isConnected && toggleChannel(channelKey)}
                  >
                    <Checkbox
                      checked={isSelected || page.isConnected}
                      disabled={page.isConnected}
                      onCheckedChange={() => toggleChannel(channelKey)}
                    />
                    {page.picture?.data?.url ? (
                      <img
                        src={page.picture.data.url}
                        alt={page.name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                        <Facebook className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{page.name}</div>
                      {page.category && (
                        <div className="text-sm text-muted-foreground">
                          {page.category}
                        </div>
                      )}
                    </div>
                    {page.isConnected && (
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        연결됨
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instagram Accounts */}
      {channels.instagram.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-pink-600" />
              Instagram Accounts
              <Badge variant="secondary">{channels.instagram.length}</Badge>
            </CardTitle>
            <CardDescription>
              Instagram DM을 받을 비즈니스 계정을 선택하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {channels.instagram.map((account) => {
                const channelKey = `instagram:${account.id}`;
                const isSelected = selectedChannels.has(channelKey);

                return (
                  <div
                    key={account.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                      account.isConnected
                        ? "bg-muted opacity-50"
                        : isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                    }`}
                    onClick={() =>
                      !account.isConnected && toggleChannel(channelKey)
                    }
                  >
                    <Checkbox
                      checked={isSelected || account.isConnected}
                      disabled={account.isConnected}
                      onCheckedChange={() => toggleChannel(channelKey)}
                    />
                    {account.profile_picture_url ? (
                      <img
                        src={account.profile_picture_url}
                        alt={account.username}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                        <Instagram className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium">@{account.username}</div>
                      {account.name && (
                        <div className="text-sm text-muted-foreground">
                          {account.name}
                        </div>
                      )}
                    </div>
                    {account.isConnected && (
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        연결됨
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Numbers */}
      {channels.whatsapp.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-green-600" />
              WhatsApp Business
              <Badge variant="secondary">{channels.whatsapp.length}</Badge>
            </CardTitle>
            <CardDescription>
              WhatsApp 메시지를 받을 전화번호를 선택하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {channels.whatsapp.map((phone) => {
                const channelKey = `whatsapp:${phone.id}`;
                const isSelected = selectedChannels.has(channelKey);

                return (
                  <div
                    key={phone.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                      phone.isConnected
                        ? "bg-muted opacity-50"
                        : isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                    }`}
                    onClick={() =>
                      !phone.isConnected && toggleChannel(channelKey)
                    }
                  >
                    <Checkbox
                      checked={isSelected || phone.isConnected}
                      disabled={phone.isConnected}
                      onCheckedChange={() => toggleChannel(channelKey)}
                    />
                    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{phone.phoneNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {phone.verifiedName || phone.wabaName}
                      </div>
                    </div>
                    <Badge
                      variant={
                        phone.qualityRating === "GREEN"
                          ? "default"
                          : phone.qualityRating === "YELLOW"
                            ? "secondary"
                            : "destructive"
                      }
                      className={
                        phone.qualityRating === "GREEN"
                          ? "bg-green-500"
                          : undefined
                      }
                    >
                      {phone.qualityRating}
                    </Badge>
                    {phone.isConnected && (
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        연결됨
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No channels available */}
      {totalAvailable === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              연결 가능한 새 채널이 없습니다. 모든 채널이 이미 연결되어 있습니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => router.push("/settings/channels")}
        >
          취소
        </Button>
        <Button
          onClick={handleConnect}
          disabled={selectedChannels.size === 0 || connecting}
        >
          {connecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              연결 중...
            </>
          ) : (
            `${selectedChannels.size}개 채널 연결`
          )}
        </Button>
      </div>
    </div>
  );
}

export default function ChannelConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-6">
          <Card>
            <CardContent className="py-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <ChannelConnectContent />
    </Suspense>
  );
}
