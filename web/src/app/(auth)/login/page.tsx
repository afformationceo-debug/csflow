"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

// LLM/RAG 네트워크 노드 데이터 (더 많은 노드로 확장)
const networkNodes = [
  { id: 1, label: "GPT-4o", x: 15, y: 20, color: "#8b5cf6", size: 80 },
  { id: 2, label: "Claude", x: 85, y: 15, color: "#3b82f6", size: 80 },
  { id: 3, label: "RAG", x: 50, y: 40, color: "#10b981", size: 100 },
  { id: 4, label: "Vector DB", x: 25, y: 65, color: "#f59e0b", size: 70 },
  { id: 5, label: "Knowledge", x: 75, y: 70, color: "#ec4899", size: 70 },
  { id: 6, label: "DeepL", x: 50, y: 85, color: "#06b6d4", size: 60 },
  { id: 7, label: "Whisper", x: 10, y: 50, color: "#f43f5e", size: 60 },
  { id: 8, label: "Vision", x: 90, y: 45, color: "#a855f7", size: 60 },
];

const connections = [
  { from: 1, to: 3 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 3, to: 5 },
  { from: 3, to: 6 },
  { from: 4, to: 5 },
  { from: 7, to: 3 },
  { from: 8, to: 3 },
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      {/* 배경 그라디언트 애니메이션 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.15),transparent_60%)]" />

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      {/* LLM/RAG 네트워크 시각화 배경 */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

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
                stroke="url(#lineGradient)"
                strokeWidth="3"
                filter="url(#glow)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.7 }}
                transition={{
                  duration: 2,
                  delay: i * 0.15,
                  repeat: Infinity,
                  repeatType: "reverse",
                  repeatDelay: 1,
                }}
              />
            );
          })}
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
              duration: 0.6,
              delay: i * 0.1,
              repeat: Infinity,
              repeatType: "reverse",
              repeatDelay: 2,
            }}
          >
            <div
              className="rounded-full flex items-center justify-center text-xs font-bold text-white shadow-2xl backdrop-blur-sm border border-white/20"
              style={{
                width: node.size,
                height: node.size,
                backgroundColor: node.color + "40",
                boxShadow: `0 0 40px ${node.color}, 0 0 80px ${node.color}40`,
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
                scale: [1, 1.8, 1],
                opacity: [0.6, 0, 0.6],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.4,
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* 메인 로그인 컨테이너 */}
      <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
        <div className="w-full max-w-7xl grid lg:grid-cols-2 gap-12 items-center">
          {/* 좌측: 브랜딩 및 메시지 */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-left space-y-8"
          >
            <div className="space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="inline-block"
              >
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 via-blue-500 to-emerald-500 flex items-center justify-center shadow-2xl">
                  <span className="text-5xl">🤖</span>
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-6xl lg:text-7xl font-bold leading-tight"
              >
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-400 to-emerald-400">
                  CS 자동화
                </span>
                <br />
                <span className="text-white">플랫폼</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="text-2xl text-white/80 leading-relaxed"
              >
                오늘 하루도 수고 많으십니다.
                <br />
                <span className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-emerald-400">
                  CS자동화, 현실로 경험해보세요.
                </span>
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-2xl">⚡</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">AI 자동 응대</h3>
                  <p className="text-white/60 text-sm">GPT-4o + Claude 혼합 모델</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-2xl">🌍</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">실시간 번역</h3>
                  <p className="text-white/60 text-sm">8개 언어 DeepL 번역</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">통합 관리</h3>
                  <p className="text-white/60 text-sm">6개 채널 통합 인박스</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* 우측: 로그인 폼 */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full"
          >
            {/* 글로우 효과 */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600 rounded-3xl blur-3xl opacity-20 animate-pulse" />

            {/* 카드 */}
            <div className="relative bg-white/5 backdrop-blur-2xl rounded-3xl p-10 border border-white/10 shadow-2xl">
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-2">로그인</h2>
                  <p className="text-white/60">관리자 계정으로 접속하세요</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
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
                      className="h-14 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-400 focus:ring-purple-400/20 text-lg"
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
                      className="h-14 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-400 focus:ring-purple-400/20 text-lg"
                    />
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm"
                    >
                      {error}
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600 hover:from-purple-700 hover:via-blue-700 hover:to-emerald-700 text-white font-semibold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    {loading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        로그인 중...
                      </div>
                    ) : (
                      "로그인"
                    )}
                  </Button>
                </form>

                {/* AI 파워드 바이 */}
                <div className="text-center space-y-3 pt-6 border-t border-white/10">
                  <p className="text-xs text-white/40">
                    Powered by Advanced AI Technology
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-75" />
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-150" />
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/50">
                    <span>GPT-4o</span>
                    <span>•</span>
                    <span>Claude</span>
                    <span>•</span>
                    <span>RAG</span>
                    <span>•</span>
                    <span>DeepL</span>
                    <span>•</span>
                    <span>Whisper</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
