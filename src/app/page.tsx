'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getStoredAuth, storeAuth } from '@/lib/auth';

export default function CharacterCreatePage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [displayedGreeting, setDisplayedGreeting] = useState('');
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 已登录则直接跳转
  useEffect(() => {
    const auth = getStoredAuth();
    if (auth) {
      router.replace('/map');
    }
  }, [router]);

  // 提交后请求 AI 问候语
  useEffect(() => {
    if (!submitted) return;

    const auth = getStoredAuth();
    const characterName = auth?.username ?? username;

    fetch('/api/greeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterName }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.greeting) {
          setGreeting(data.greeting);
        }
      })
      .catch(() => {
        setGreeting(`${characterName}，愿这段旅途如水般温柔，我们慢慢走。`);
      });
  }, [submitted, username]);

  // 打字机效果
  useEffect(() => {
    if (!greeting) return;

    let index = 0;
    typingRef.current = setInterval(() => {
      index++;
      setDisplayedGreeting(greeting.slice(0, index));
      if (index >= greeting.length && typingRef.current) {
        clearInterval(typingRef.current);
        typingRef.current = null;
      }
    }, 60);

    return () => {
      if (typingRef.current) {
        clearInterval(typingRef.current);
      }
    };
  }, [greeting]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || '操作失败');
        setIsSubmitting(false);
        return;
      }

      // 保存认证信息
      storeAuth({
        token: data.token,
        playerId: data.player.id,
        username: data.player.username,
      });

      setIsSubmitting(false);
      setSubmitted(true);
    } catch {
      setError('网络错误，请重试');
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    const auth = getStoredAuth();
    const displayName = auth?.username ?? username;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-8 animate-fade-in-up">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-accent/60 flex items-center justify-center animate-float">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent-green"
              >
                <path d="M12 2C8 7 4 9 4 13a8 8 0 0 0 16 0c0-4-4-6-8-11z" />
              </svg>
            </div>
          </div>

          <div className="space-y-3">
            <h2
              className="text-xl font-light tracking-wider text-foreground/85"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {displayName}，旅途将启
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed min-h-[3em]">
              {displayedGreeting || '\u00A0'}
              <span
                className={`inline-block w-px h-[1em] align-middle bg-muted-foreground/40 ml-0.5 ${greeting && displayedGreeting.length >= greeting.length ? 'animate-blink' : ''}`}
              />
            </p>
          </div>

          <Button
            onClick={() => router.push('/map')}
            className="bg-accent-green/10 border border-accent-green/20 text-accent-green hover:bg-accent-green/18 hover:border-accent-green/35 transition-all duration-500 text-sm tracking-[0.08em] rounded-lg px-8 h-11"
          >
            选择目的地
          </Button>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/40">
            <span className="inline-block w-5 h-px bg-border" />
            <span style={{ fontFamily: 'var(--font-serif)' }}>别处 · Elsewhere (Demo)</span>
            <span className="inline-block w-5 h-px bg-border" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-10">
        {/* 标题区 */}
        <header className="space-y-4 text-center animate-fade-in-up">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="inline-block w-8 h-px bg-border" />
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent-green/60"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
            <span className="inline-block w-8 h-px bg-border" />
          </div>
          <h1
            className="text-2xl font-extralight tracking-[0.12em] text-foreground/90"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            别处 · Elsewhere
          </h1>
          <p className="text-sm text-muted-foreground/70 leading-relaxed tracking-wide">
            输入名称和暗号，开始或继续你的旅途
          </p>
        </header>

        {/* 表单区 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 角色名称 */}
          <div className="space-y-2.5 animate-fade-in-up-delay-1">
            <Label
              htmlFor="username"
              className="text-xs tracking-widest text-muted-foreground/70"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              旅人名称
            </Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="你希望被怎样称呼"
              required
              maxLength={20}
              className="travel-input bg-input/40 border-border/70 h-11 text-sm tracking-wide placeholder:text-muted-foreground/35 focus:border-accent-green-dim/50 transition-all duration-500"
            />
          </div>

          {/* 暗号 */}
          <div className="space-y-2.5 animate-fade-in-up-delay-1">
            <Label
              htmlFor="password"
              className="text-xs tracking-widest text-muted-foreground/70"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              暗号
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="3-30位，记住它以继续旅途"
              required
              minLength={3}
              maxLength={30}
              className="travel-input bg-input/40 border-border/70 h-11 text-sm tracking-wide placeholder:text-muted-foreground/35 focus:border-accent-green-dim/50 transition-all duration-500"
            />
            <p className="text-[11px] text-muted-foreground/40 pl-0.5">
              新名称将自动注册，已有名称请输入原暗号
            </p>
          </div>

          {/* 错误信息 */}
          {error && (
            <p className="text-xs text-red-500/80 text-center animate-fade-in-up">
              {error}
            </p>
          )}

          {/* 提交按钮 */}
          <div className="pt-3 animate-fade-in-up-delay-2">
            <Button
              type="submit"
              disabled={isSubmitting || !username || !password}
              className="w-full h-11 bg-accent-green/10 border border-accent-green/20 text-accent-green hover:bg-accent-green/18 hover:border-accent-green/35 disabled:opacity-30 disabled:hover:bg-accent-green/10 disabled:hover:border-accent-green/20 transition-all duration-500 text-sm tracking-[0.08em] rounded-lg"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  准备中...
                </span>
              ) : (
                '开始旅途'
              )}
            </Button>
          </div>
        </form>

        {/* 底部信息 */}
        <div className="text-center animate-fade-in-up-delay-3">
          <p
            className="text-[11px] text-muted-foreground/30 tracking-[0.15em]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            别处 · Elsewhere (Demo)
          </p>
        </div>
      </div>
    </div>
  );
}
