// Conversation hooks
export {
  useConversations,
  useConversationsRealtime,
  useUpdateConversation,
  useMarkAsRead,
  calculateWaitTime,
  useWaitTimeUpdater,
  type ConversationListItem,
  type ConversationFilters,
} from "./use-conversations";

// Message hooks
export {
  useMessages,
  useInternalNotes,
  useUnifiedMessages,
  useMessagesRealtime,
  useSendMessage,
  useCreateInternalNote,
  formatMessageTime,
  type MessageItem,
  type InternalNoteItem,
  type UnifiedMessageItem,
} from "./use-messages";

// Customer hooks
export {
  useCustomer,
  useUpdateCustomer,
  useUpdateConsultationTag,
  useAddTag,
  useRemoveTag,
  getConsultationTag,
  getOtherTags,
  type CustomerDetail,
} from "./use-customers";

// Knowledge base hooks
export {
  useKnowledgeDocuments,
  useKnowledgeDocument,
  useKnowledgeCategories,
  useKnowledgeStatistics,
  useCreateKnowledgeDocument,
  useUpdateKnowledgeDocument,
  useDeleteKnowledgeDocument,
  useRegenerateEmbeddings,
  type KnowledgeDocumentItem,
  type KnowledgeDocumentFilters,
  type CreateDocumentInput,
  type UpdateDocumentInput,
} from "./use-knowledge-base";

// CRM hooks
export {
  useCRMCustomer,
  useSearchCRMCustomers,
  useCreateCRMCustomer,
  useUpdateCRMCustomer,
  useSyncCustomerToCRM,
  useCRMBookings,
  useCRMBooking,
  useCreateCRMBooking,
  useUpdateCRMBooking,
  useCancelCRMBooking,
  useCreateBookingFromConversation,
  useCRMNotes,
  useAddCRMNote,
  useCRMHealth,
} from "./use-crm";
