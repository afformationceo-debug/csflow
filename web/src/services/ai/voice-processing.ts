/**
 * Voice Message Processing Service
 * Uses OpenAI Whisper API for speech-to-text conversion
 */

import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VoiceTranscriptionResult {
  text: string;
  language: string;
  duration: number;
  confidence: number;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export interface VoiceProcessingOptions {
  language?: string; // ISO-639-1 code (e.g., "ko", "en", "ja")
  prompt?: string; // Optional context hint
  includeTimestamps?: boolean;
  translateToKorean?: boolean;
}

/**
 * Transcribe voice message from audio buffer
 */
export async function transcribeVoiceMessage(
  audioBuffer: Buffer,
  fileName: string,
  options: VoiceProcessingOptions = {}
): Promise<VoiceTranscriptionResult> {
  const { language, prompt, includeTimestamps = false } = options;

  // Create a File-like object from buffer
  // Convert Buffer to Uint8Array first for proper BlobPart compatibility
  const audioFile = new File([new Uint8Array(audioBuffer)], fileName, {
    type: getMimeType(fileName),
  });

  try {
    // Use Whisper API for transcription
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: language,
      prompt: prompt,
      response_format: includeTimestamps ? "verbose_json" : "json",
      timestamp_granularities: includeTimestamps ? ["segment"] : undefined,
    });

    // Parse response based on format
    if (includeTimestamps && typeof response === "object" && "segments" in response) {
      const verboseResponse = response as OpenAI.Audio.Transcription & {
        language: string;
        duration: number;
        segments: Array<{
          id: number;
          start: number;
          end: number;
          text: string;
          avg_logprob: number;
        }>;
      };

      return {
        text: verboseResponse.text,
        language: verboseResponse.language || detectLanguageFromText(verboseResponse.text),
        duration: verboseResponse.duration || 0,
        confidence: calculateAverageConfidence(verboseResponse.segments),
        segments: verboseResponse.segments.map((seg) => ({
          id: seg.id,
          start: seg.start,
          end: seg.end,
          text: seg.text,
          confidence: Math.exp(seg.avg_logprob), // Convert log prob to probability
        })),
      };
    }

    return {
      text: response.text,
      language: detectLanguageFromText(response.text),
      duration: 0,
      confidence: 0.9, // Default confidence when not using verbose mode
    };
  } catch (error) {
    console.error("Voice transcription error:", error);
    throw new Error(`Failed to transcribe voice message: ${error}`);
  }
}

/**
 * Transcribe voice message from URL
 */
export async function transcribeVoiceFromUrl(
  audioUrl: string,
  options: VoiceProcessingOptions = {}
): Promise<VoiceTranscriptionResult> {
  // Fetch audio from URL
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio from URL: ${response.statusText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const fileName = extractFileName(audioUrl);

  return transcribeVoiceMessage(audioBuffer, fileName, options);
}

/**
 * Translate audio directly to English (useful for non-English audio)
 */
export async function translateVoiceToEnglish(
  audioBuffer: Buffer,
  fileName: string,
  prompt?: string
): Promise<VoiceTranscriptionResult> {
  // Convert Buffer to Uint8Array first for proper BlobPart compatibility
  const audioFile = new File([new Uint8Array(audioBuffer)], fileName, {
    type: getMimeType(fileName),
  });

  try {
    const response = await openai.audio.translations.create({
      file: audioFile,
      model: "whisper-1",
      prompt: prompt,
      response_format: "json",
    });

    return {
      text: response.text,
      language: "en",
      duration: 0,
      confidence: 0.9,
    };
  } catch (error) {
    console.error("Voice translation error:", error);
    throw new Error(`Failed to translate voice message: ${error}`);
  }
}

/**
 * Process voice message and integrate with RAG pipeline
 */
export async function processVoiceMessageForRAG(
  conversationId: string,
  audioBuffer: Buffer,
  fileName: string,
  options: VoiceProcessingOptions = {}
): Promise<{
  transcription: VoiceTranscriptionResult;
  messageId: string;
}> {
  const supabase = await createServiceClient();

  // Transcribe the voice message
  const transcription = await transcribeVoiceMessage(audioBuffer, fileName, {
    ...options,
    includeTimestamps: true,
  });

  // Store the transcription as a message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: message, error } = await (supabase as any)
    .from("messages")
    .insert({
      conversation_id: conversationId,
      direction: "inbound",
      sender_type: "customer",
      content_type: "audio",
      content: transcription.text,
      original_content: transcription.text,
      original_language: transcription.language,
      metadata: {
        voice_transcription: {
          duration: transcription.duration,
          confidence: transcription.confidence,
          segments: transcription.segments,
        },
        original_file: fileName,
      },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store transcription: ${error.message}`);
  }

  return {
    transcription,
    messageId: message.id,
  };
}

/**
 * Download and transcribe voice message from Supabase Storage
 */
export async function transcribeStoredVoiceMessage(
  storagePath: string,
  options: VoiceProcessingOptions = {}
): Promise<VoiceTranscriptionResult> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase.storage
    .from("media")
    .download(storagePath);

  if (error) {
    throw new Error(`Failed to download audio file: ${error.message}`);
  }

  const audioBuffer = Buffer.from(await data.arrayBuffer());
  const fileName = storagePath.split("/").pop() || "audio.mp3";

  return transcribeVoiceMessage(audioBuffer, fileName, options);
}

// Helper functions

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    mp3: "audio/mpeg",
    mp4: "audio/mp4",
    m4a: "audio/m4a",
    wav: "audio/wav",
    webm: "audio/webm",
    ogg: "audio/ogg",
    flac: "audio/flac",
  };
  return mimeTypes[ext || ""] || "audio/mpeg";
}

function extractFileName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split("/").pop();
    return fileName || "audio.mp3";
  } catch {
    return "audio.mp3";
  }
}

function detectLanguageFromText(text: string): string {
  // Simple language detection based on character ranges
  const koreanRegex = /[\uAC00-\uD7AF]/;
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
  const chineseRegex = /[\u4E00-\u9FFF]/;
  const thaiRegex = /[\u0E00-\u0E7F]/;
  const vietnameseRegex = /[\u00C0-\u1EF9]/;

  if (koreanRegex.test(text)) return "ko";
  if (japaneseRegex.test(text)) return "ja";
  if (chineseRegex.test(text)) return "zh";
  if (thaiRegex.test(text)) return "th";
  if (vietnameseRegex.test(text)) return "vi";

  return "en"; // Default to English
}

function calculateAverageConfidence(
  segments: Array<{ avg_logprob: number }>
): number {
  if (!segments || segments.length === 0) return 0.9;

  const avgLogProb =
    segments.reduce((sum, seg) => sum + seg.avg_logprob, 0) / segments.length;

  // Convert log probability to probability (0-1 range)
  return Math.min(Math.exp(avgLogProb), 1);
}

export const voiceProcessingService = {
  transcribeVoiceMessage,
  transcribeVoiceFromUrl,
  translateVoiceToEnglish,
  processVoiceMessageForRAG,
  transcribeStoredVoiceMessage,
};
