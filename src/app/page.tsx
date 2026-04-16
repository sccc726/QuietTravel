'use client';

import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Loader2, Terminal } from 'lucide-react';

export default function CharacterCreatePage() {
  const [characterName, setCharacterName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    // 模拟提交
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  if (submitted) {
    return (
      <div className="min-h-screen cyber-grid flex items-center justify-center px-4 relative overflow-hidden">
        {/* 扫描线装饰 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyber/20 to-transparent animate-scanline" />
        </div>

        <div className="max-w-md w-full text-center space-y-6 animate-fade-in-up">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full border border-cyber/30 flex items-center justify-center">
              <Terminal className="w-7 h-7 text-cyber animate-breathe" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-light tracking-widest text-foreground/90">
              身份已确认
            </h2>
            <p className="text-sm text-muted-foreground tracking-wide">
              旅者 <span className="text-cyber font-mono">{characterName}</span>，欢迎接入赛博空间
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60 font-mono">
            <span className="inline-block w-2 h-2 rounded-full bg-cyber/60 animate-breathe" />
            <span>正在初始化世界数据...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen cyber-grid flex items-center justify-center px-4 relative overflow-hidden">
      {/* 顶部扫描线装饰 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyber/20 to-transparent animate-scanline" />
      </div>

      {/* 角落装饰 */}
      <div className="absolute top-6 left-6 text-[10px] font-mono text-cyber-dim/40 tracking-widest animate-fade-in-up">
        SYS.TERMINAL.v0.1
      </div>
      <div className="absolute top-6 right-6 text-[10px] font-mono text-cyber-dim/40 tracking-widest animate-fade-in-up">
        NODE.0721
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] font-mono text-cyber-dim/40 tracking-widest">
        ────────────
      </div>
      <div className="absolute bottom-6 right-6 text-[10px] font-mono text-cyber-dim/40 tracking-widest">
        SECTOR.CYBER
      </div>

      {/* 主内容 */}
      <div className="max-w-sm w-full space-y-10 relative z-10">
        {/* 标题区 */}
        <header className="space-y-3 text-center animate-fade-in-up">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyber/60 animate-breathe" />
            <span className="text-[11px] font-mono tracking-[0.3em] text-cyber-dim uppercase">
              New Identity
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyber/60 animate-breathe" />
          </div>
          <h1 className="text-2xl font-extralight tracking-[0.15em] text-foreground/90">
            创建角色
          </h1>
          <p className="text-xs text-muted-foreground/70 tracking-wider leading-relaxed">
            在赛博空间中建立你的数字身份
          </p>
        </header>

        {/* 分隔线 */}
        <div className="flex items-center gap-3 animate-fade-in-up-delay-1">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-border" />
          <span className="text-[9px] font-mono text-cyber-dim/40 tracking-widest">FORM</span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-border" />
        </div>

        {/* 表单区 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 角色名称 */}
          <div className="space-y-2 animate-fade-in-up-delay-1">
            <Label
              htmlFor="characterName"
              className="text-[11px] font-mono tracking-widest text-muted-foreground/80 uppercase"
            >
              角色名称
            </Label>
            <Input
              id="characterName"
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="你的旅者代号"
              required
              className="cyber-input bg-input/50 border-border/60 h-10 text-sm tracking-wide placeholder:text-muted-foreground/30 focus:border-cyber/40 transition-all duration-500"
            />
            <p className="text-[10px] text-muted-foreground/40 font-mono">
              此名称将在赛博世界中展示
            </p>
          </div>

          {/* 用户名 */}
          <div className="space-y-2 animate-fade-in-up-delay-2">
            <Label
              htmlFor="username"
              className="text-[11px] font-mono tracking-widest text-muted-foreground/80 uppercase"
            >
              用户名
            </Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="登录凭证"
              required
              className="cyber-input bg-input/50 border-border/60 h-10 text-sm tracking-wide font-mono placeholder:text-muted-foreground/30 focus:border-cyber/40 transition-all duration-500"
            />
            <p className="text-[10px] text-muted-foreground/40 font-mono">
              用于身份验证的唯一标识
            </p>
          </div>

          {/* 密码 */}
          <div className="space-y-2 animate-fade-in-up-delay-3">
            <Label
              htmlFor="password"
              className="text-[11px] font-mono tracking-widest text-muted-foreground/80 uppercase"
            >
              密码
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="加密密钥"
                required
                className="cyber-input bg-input/50 border-border/60 h-10 text-sm tracking-wide font-mono placeholder:text-muted-foreground/30 focus:border-cyber/40 transition-all duration-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-cyber-dim transition-colors duration-300"
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground/40 font-mono">
              建议不少于8位，含大小写与数字
            </p>
          </div>

          {/* 提交按钮 */}
          <div className="pt-2 animate-fade-in-up-delay-4">
            <Button
              type="submit"
              disabled={isSubmitting || !characterName || !username || !password}
              className="w-full h-10 bg-cyber/15 border border-cyber/25 text-cyber hover:bg-cyber/25 hover:border-cyber/40 disabled:opacity-30 disabled:hover:bg-cyber/15 disabled:hover:border-cyber/25 transition-all duration-500 text-xs tracking-[0.2em] font-mono uppercase rounded-md"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  正在接入...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-1 h-1 rounded-full bg-cyber/60" />
                  接入赛博空间
                  <span className="inline-block w-1 h-1 rounded-full bg-cyber/60" />
                </span>
              )}
            </Button>
          </div>
        </form>

        {/* 底部信息 */}
        <div className="text-center animate-fade-in-up-delay-4">
          <p className="text-[10px] text-muted-foreground/30 font-mono tracking-wider">
            CYBER VOYAGE ─ 赛博旅途
          </p>
        </div>
      </div>
    </div>
  );
}
