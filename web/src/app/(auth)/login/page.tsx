"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

// LLM/RAG 네트워크 노드 데이터
const networkNodes = [
  { id: 1, label: "GPT-4", x: 20, y: 30, color: "#8b5cf6" },
  { id: 2, label: "Claude", x: 80, y: 20, color: "#3b82f6" },
  { id: 3, label: "RAG", x: 50, y: 50, color: "#10b981" },
  { id: 4, label: "Vector DB", x: 30, y: 70, color: "#f59e0b" },
  { id: 5, label: "Knowledge", x: 70, y: 65, color: "#ec4899" },
  { id: 6, label: "Chat", x: 50, y: 85, color: "#06b6d4" },
];

const connections = [
  { from: 1, to: 3 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 3, to: 5 },
  { from: 3, to: 6 },
  { from: 4, to: 5 },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900">
      {/* 배경 그라디언트 애니메이션 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.1),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.1),transparent_50%)]" />

      {/* LLM/RAG 네트워크 시각화 배경 */}
      <div className="absolute inset-0 opacity-30">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* 연결선 애니메이션 */}
          {connections.map((conn, i) => {
            const fromNode = networkNodes.find((n) => n.id === conn.from)!;
            const toNode = networkNodes.find((n) => n.id === conn.to)!;
            return (
              <motion.line
                key={i}
                x1={`${fromNode.x}%`}
                y1={`${fromNode.y}%`}
                x2={`${toNode.x}%`}
                y2={`${toNode.y}%`}
                stroke="url(#gradient)"
                strokeWidth="2"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                transition={{
                  duration: 2,
                  delay: i * 0.2,
                  repeat: Infinity,
                  repeatType: "reverse",
                  repeatDelay: 1,
                }}
              />
            );
          })}

          {/* 그라디언트 정의 */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>

        {/* 노드 애니메이션 */}
        {networkNodes.map((node, i) => (
          <motion.div
            key={node.id}
            className="absolute"
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 0.5,
              delay: i * 0.15,
              repeat: Infinity,
              repeatType: "reverse",
              repeatDelay: 2,
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-2xl"
              style={{
                backgroundColor: node.color,
                boxShadow: `0 0 30px ${node.color}`,
              }}
            >
              {node.label}
            </div>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: node.color,
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* 메인 로그인 카드 */}
      <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md"
        >
          {/* 글로우 효과 */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600 rounded-3xl blur-3xl opacity-20 animate-pulse" />

          {/* 카드 */}
          <div className="relative bg-white/10 backdrop-blur-2xl rounded-3xl p-8 border border-white/20 shadow-2xl">
            {/* 헤더 */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mb-4"
              >
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 via-blue-500 to-emerald-500 flex items-center justify-center shadow-2xl">
                  <span className="text-4xl">🤖</span>
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="text-3xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-400 to-emerald-400"
              >
                CS 자동화 플랫폼
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="text-white/80 text-sm"
              >
                오늘 하루도 수고 많으십니다.
                <br />
                <span className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-emerald-400">
                  CS자동화, 현실로 경험해보세요.
                </span>
              </motion.p>
            </div>

            {/* 로그인 폼 */}
            <motion.form
              onSubmit={handleLogin}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/90">
                  이메일
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="afformation.ceo@gmail.com"
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/90">
                  비밀번호
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20"
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm"
                >
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600 hover:from-purple-700 hover:via-blue-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    로그인 중...
                  </div>
                ) : (
                  "로그인"
                )}
              </Button>
            </motion.form>

            {/* AI 파워드 바이 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1 }}
              className="mt-8 text-center"
            >
              <p className="text-xs text-white/50">
                Powered by GPT-4 + Claude + RAG Pipeline
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-75" />
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-150" />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
