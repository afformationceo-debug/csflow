import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crmService, CRMCustomer, CRMBooking, CRMNote } from "@/services/crm";

// Query keys
const crmKeys = {
  all: ["crm"] as const,
  customer: (id: string) => [...crmKeys.all, "customer", id] as const,
  customerBookings: (customerId: string) =>
    [...crmKeys.all, "bookings", customerId] as const,
  customerNotes: (customerId: string) =>
    [...crmKeys.all, "notes", customerId] as const,
  booking: (id: string) => [...crmKeys.all, "booking", id] as const,
  health: () => [...crmKeys.all, "health"] as const,
};

/**
 * Hook to fetch CRM customer
 */
export function useCRMCustomer(customerId: string | null) {
  return useQuery({
    queryKey: crmKeys.customer(customerId || ""),
    queryFn: () => crmService.getCustomer(customerId!),
    enabled: !!customerId,
  });
}

/**
 * Hook to search CRM customers
 */
export function useSearchCRMCustomers() {
  return useMutation({
    mutationFn: (query: { phone?: string; email?: string; name?: string }) =>
      crmService.searchCustomers(query),
  });
}

/**
 * Hook to create CRM customer
 */
export function useCreateCRMCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof crmService.createCustomer>[0]) =>
      crmService.createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.all });
    },
  });
}

/**
 * Hook to update CRM customer
 */
export function useUpdateCRMCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      data,
    }: {
      customerId: string;
      data: Parameters<typeof crmService.updateCustomer>[1];
    }) => crmService.updateCustomer(customerId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: crmKeys.customer(variables.customerId),
      });
    },
  });
}

/**
 * Hook to sync customer to CRM
 */
export function useSyncCustomerToCRM() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof crmService.syncCustomer>[0]) =>
      crmService.syncCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.all });
    },
  });
}

/**
 * Hook to fetch CRM customer bookings
 */
export function useCRMBookings(customerId: string | null) {
  return useQuery({
    queryKey: crmKeys.customerBookings(customerId || ""),
    queryFn: () => crmService.getCustomerBookings(customerId!),
    enabled: !!customerId,
  });
}

/**
 * Hook to fetch single CRM booking
 */
export function useCRMBooking(bookingId: string | null) {
  return useQuery({
    queryKey: crmKeys.booking(bookingId || ""),
    queryFn: () => crmService.getBooking(bookingId!),
    enabled: !!bookingId,
  });
}

/**
 * Hook to create CRM booking
 */
export function useCreateCRMBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof crmService.createBooking>[0]) =>
      crmService.createBooking(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: crmKeys.customerBookings(variables.customerId),
      });
    },
  });
}

/**
 * Hook to update CRM booking
 */
export function useUpdateCRMBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bookingId,
      data,
    }: {
      bookingId: string;
      data: Parameters<typeof crmService.updateBooking>[1];
    }) => crmService.updateBooking(bookingId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: crmKeys.booking(variables.bookingId),
      });
    },
  });
}

/**
 * Hook to cancel CRM booking
 */
export function useCancelCRMBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason?: string;
    }) => crmService.cancelBooking(bookingId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...crmKeys.all, "bookings"],
      });
    },
  });
}

/**
 * Hook to create booking from conversation
 */
export function useCreateBookingFromConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: Parameters<typeof crmService.createBookingFromConversation>[0]
    ) => crmService.createBookingFromConversation(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: crmKeys.customerBookings(variables.crmCustomerId),
      });
    },
  });
}

/**
 * Hook to fetch CRM customer notes
 */
export function useCRMNotes(customerId: string | null) {
  return useQuery({
    queryKey: crmKeys.customerNotes(customerId || ""),
    queryFn: () => crmService.getCustomerNotes(customerId!),
    enabled: !!customerId,
  });
}

/**
 * Hook to add CRM note
 */
export function useAddCRMNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      content,
      authorId,
      authorName,
    }: {
      customerId: string;
      content: string;
      authorId?: string;
      authorName?: string;
    }) => crmService.addNote(customerId, content, authorId, authorName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: crmKeys.customerNotes(variables.customerId),
      });
    },
  });
}

/**
 * Hook to check CRM API health
 */
export function useCRMHealth() {
  return useQuery({
    queryKey: crmKeys.health(),
    queryFn: () => crmService.checkHealth(),
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });
}
