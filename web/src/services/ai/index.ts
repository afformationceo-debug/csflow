// Core AI Services
export { generateEmbedding, generateEmbeddings, chunkText } from "./embeddings";
export { retrieveDocuments, hybridSearch, fullTextSearch } from "./retriever";
export { llmService } from "./llm";
export { ragPipeline } from "./rag-pipeline";
export { knowledgeBaseService } from "./knowledge-base";

// Phase 6 AI Services
export { voiceProcessingService } from "./voice-processing";
export { imageAnalysisService } from "./image-analysis";
export { sentimentAnalysisService } from "./sentiment-analysis";
export { conversionPredictionService } from "./conversion-prediction";
export { proactiveOutreachService } from "./proactive-outreach";

// Phase 7 AI Services
export { fineTuningService } from "./fine-tuning";

// Core Types
export type { RetrievedDocument, RetrievalOptions } from "./retriever";
export type { LLMModel, LLMResponse, GenerateOptions } from "./llm";
export type { RAGInput, RAGOutput, EscalationDecision } from "./rag-pipeline";
export type { CreateDocumentInput, UpdateDocumentInput } from "./knowledge-base";

// Phase 6 Types
export type {
  VoiceTranscriptionResult,
  TranscriptionSegment,
  VoiceProcessingOptions,
} from "./voice-processing";

export type {
  ImageAnalysisResult,
  ImageCategory,
  MedicalImageAnalysis,
  ImageAnalysisOptions,
} from "./image-analysis";

export type {
  SentimentResult,
  SentimentType,
  UrgencyLevel,
  EmotionScore,
  SentimentAnalysisOptions,
} from "./sentiment-analysis";

export type {
  ConversionPrediction,
  ConversionStage,
  ConversionFactor,
  RecommendedAction,
  CustomerFeatures,
} from "./conversion-prediction";

export type {
  OutreachCandidate,
  OutreachReason,
  OutreachCampaign,
  TargetCriteria,
  CampaignStats,
} from "./proactive-outreach";

// Phase 7 Types
export type {
  TrainingExample,
  FineTuningJob,
  TrainingDataStats,
} from "./fine-tuning";
