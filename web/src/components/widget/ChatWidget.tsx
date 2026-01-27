"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Paperclip, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatWidgetConfig {
  tenantId: string;
  apiUrl: string;
  position?: "bottom-right" | "bottom-left";
  primaryColor?: string;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  welcomeMessage?: string;
  language?: string;
  showPoweredBy?: boolean;
  avatarUrl?: string;
  customStyles?: {
    buttonSize?: number;
    borderRadius?: number;
    fontFamily?: string;
  };
}

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot" | "agent";
  timestamp: Date;
  status?: "sending" | "sent" | "error";
}

interface ChatWidgetProps {
  config: ChatWidgetConfig;
}

export function ChatWidget({ config }: ChatWidgetProps) {
  const {
    tenantId,
    apiUrl,
    position = "bottom-right",
    primaryColor = "#2563eb",
    title = "채팅 상담",
    subtitle = "무엇을 도와드릴까요?",
    placeholder = "메시지를 입력하세요...",
    welcomeMessage = "안녕하세요! 무엇을 도와드릴까요?",
    language = "ko",
    showPoweredBy = true,
    avatarUrl,
    customStyles = {},
  } = config;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { buttonSize = 60, borderRadius = 16, fontFamily } = customStyles;

  // Initialize session and show welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMsg: Message = {
        id: "welcome",
        content: welcomeMessage,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages([welcomeMsg]);

      // Create session
      initializeSession();
    }
  }, [isOpen, welcomeMessage, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const initializeSession = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/widget/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, language }),
      });
      const data = await response.json();
      setSessionId(data.sessionId);
    } catch (error) {
      console.error("Failed to initialize session:", error);
    }
  };

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputValue.trim(),
      sender: "user",
      timestamp: new Date(),
      status: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/widget/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          sessionId,
          message: userMessage.content,
          language,
        }),
      });

      const data = await response.json();

      // Update user message status
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, status: "sent" } : msg
        )
      );

      // Add bot response
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        content: data.response,
        sender: data.isAI ? "bot" : "agent",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, status: "error" } : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, apiUrl, tenantId, sessionId, language]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const positionClasses = {
    "bottom-right": "right-4 bottom-4",
    "bottom-left": "left-4 bottom-4",
  };

  return (
    <div
      className={cn("fixed z-[9999]", positionClasses[position])}
      style={{ fontFamily: fontFamily || "inherit" }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="mb-4 flex flex-col bg-white shadow-2xl overflow-hidden"
            style={{
              borderRadius: `${borderRadius}px`,
              width: "380px",
              height: "560px",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                  >
                    <MessageCircle className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-sm">{title}</h3>
                  <p className="text-xs opacity-80">{subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex",
                    message.sender === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                      message.sender === "user"
                        ? "text-white"
                        : "bg-white shadow-sm text-gray-800"
                    )}
                    style={{
                      backgroundColor:
                        message.sender === "user" ? primaryColor : undefined,
                      borderBottomRightRadius:
                        message.sender === "user" ? "4px" : undefined,
                      borderBottomLeftRadius:
                        message.sender !== "user" ? "4px" : undefined,
                    }}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.status === "error" && (
                      <p className="text-xs text-red-300 mt-1">전송 실패</p>
                    )}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white shadow-sm rounded-2xl px-4 py-2 rounded-bl">
                    <div className="flex space-x-1">
                      <span
                        className="w-2 h-2 rounded-full animate-bounce"
                        style={{
                          backgroundColor: primaryColor,
                          animationDelay: "0ms",
                        }}
                      />
                      <span
                        className="w-2 h-2 rounded-full animate-bounce"
                        style={{
                          backgroundColor: primaryColor,
                          animationDelay: "150ms",
                        }}
                      />
                      <span
                        className="w-2 h-2 rounded-full animate-bounce"
                        style={{
                          backgroundColor: primaryColor,
                          animationDelay: "300ms",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t">
              <div className="flex items-end gap-2">
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Paperclip className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={placeholder}
                    rows={1}
                    className="w-full resize-none rounded-xl border border-gray-200 px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={
                      { "--tw-ring-color": primaryColor } as React.CSSProperties
                    }
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="p-2 rounded-xl text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Powered by */}
            {showPoweredBy && (
              <div className="text-center py-2 text-xs text-gray-400 bg-white border-t">
                Powered by CS Automation
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full shadow-lg flex items-center justify-center text-white transition-transform"
        style={{
          backgroundColor: primaryColor,
          width: `${buttonSize}px`,
          height: `${buttonSize}px`,
        }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
            >
              <MessageCircle className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

export default ChatWidget;
