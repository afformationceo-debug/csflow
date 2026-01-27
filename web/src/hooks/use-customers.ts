"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { ConsultationTag, ChannelType } from "@/lib/supabase/types";

// Types
export interface CustomerDetail {
  id: string;
  tenant_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  country: string | null;
  profile_image_url: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  crm_customer_id: string | null;
  is_vip: boolean;
  created_at: string;
  updated_at: string;
  customer_channels?: {
    id: string;
    channel_user_id: string;
    channel_username: string | null;
    is_primary: boolean;
    channel_account: {
      channel_type: ChannelType;
      account_name: string;
    };
  }[];
  bookings?: {
    id: string;
    booking_type: string | null;
    scheduled_at: string;
    status: string;
    notes: string | null;
  }[];
}

// 고객 상세 조회 훅
export function useCustomer(customerId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      if (!customerId) return null;

      const { data, error } = await (supabase.from("customers") as any)
        .select(`
          *,
          customer_channels(
            id,
            channel_user_id,
            channel_username,
            is_primary,
            channel_account:channel_accounts(
              channel_type,
              account_name
            )
          ),
          bookings(
            id,
            booking_type,
            scheduled_at,
            status,
            notes
          )
        `)
        .eq("id", customerId)
        .single();

      if (error) throw error;
      return data as CustomerDetail;
    },
    enabled: !!customerId,
  });
}

// 고객 정보 업데이트 훅
export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      updates,
    }: {
      customerId: string;
      updates: Partial<{
        name: string;
        email: string;
        phone: string;
        country: string;
        language: string;
        is_vip: boolean;
        metadata: Record<string, unknown>;
      }>;
    }) => {
      const { data, error } = await (supabase.from("customers") as any)
        .update(updates)
        .eq("id", customerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customer", variables.customerId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// 상담 태그 업데이트 훅
export function useUpdateConsultationTag() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      consultationTag,
    }: {
      customerId: string;
      consultationTag: ConsultationTag;
    }) => {
      // 기존 태그 조회
      const { data: customer } = await (supabase.from("customers") as any)
        .select("tags")
        .eq("id", customerId)
        .single();

      const currentTags = (customer?.tags || []) as string[];

      // 기존 상담 단계 태그 제거
      const consultationTags: string[] = [
        "prospect",
        "potential",
        "first_booking",
        "confirmed",
        "completed",
        "cancelled",
      ];
      const filteredTags = currentTags.filter(
        (t: string) => !consultationTags.includes(t)
      );

      // 새 상담 태그 추가
      const newTags = [...filteredTags, consultationTag];

      const { data, error } = await (supabase.from("customers") as any)
        .update({ tags: newTags })
        .eq("id", customerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customer", variables.customerId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// 태그 추가 훅
export function useAddTag() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      tag,
    }: {
      customerId: string;
      tag: string;
    }) => {
      const { data: customer } = await (supabase.from("customers") as any)
        .select("tags")
        .eq("id", customerId)
        .single();

      const currentTags = customer?.tags || [];
      if (currentTags.includes(tag)) {
        return customer;
      }

      const { data, error } = await (supabase.from("customers") as any)
        .update({ tags: [...currentTags, tag] })
        .eq("id", customerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customer", variables.customerId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// 태그 제거 훅
export function useRemoveTag() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      tag,
    }: {
      customerId: string;
      tag: string;
    }) => {
      const { data: customer } = await (supabase.from("customers") as any)
        .select("tags")
        .eq("id", customerId)
        .single();

      const currentTags = customer?.tags || [];
      const newTags = currentTags.filter((t: string) => t !== tag);

      const { data, error } = await (supabase.from("customers") as any)
        .update({ tags: newTags })
        .eq("id", customerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customer", variables.customerId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// 현재 상담 태그 추출 함수
export function getConsultationTag(tags: string[]): ConsultationTag | null {
  const consultationTags: ConsultationTag[] = [
    "prospect",
    "potential",
    "first_booking",
    "confirmed",
    "completed",
    "cancelled",
  ];

  for (const tag of tags) {
    if (consultationTags.includes(tag as ConsultationTag)) {
      return tag as ConsultationTag;
    }
  }
  return null;
}

// 기타 태그 추출 함수 (상담 태그 제외)
export function getOtherTags(tags: string[]): string[] {
  const consultationTags = [
    "prospect",
    "potential",
    "first_booking",
    "confirmed",
    "completed",
    "cancelled",
  ];

  return tags.filter((tag) => !consultationTags.includes(tag));
}
