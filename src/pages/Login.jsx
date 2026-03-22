import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import MaterialIcon from "@/components/ui/MaterialIcon";

const LOGO_URL = 'https://lh3.googleusercontent.com/aida/ADBb0ugCTVY4RLjpZaVmTunw5aAOVsOWhVE1VFKJ6dJHWLlp0NQfYLn9e4nf9xumxgvXGuTESxzw_4nnRZgPRRibxsHY0CyQlUftQtsLyFxxoLXrjZ9yh6wRWly1I5gyuQoTheiTmM0sVUrURcN8eyeGxJOyzmOT72i8UzXFg-evAPSA6UvoOVQd-kWWxbtTNct5HKj-ohG7BatXZ9fA1b31kExHOSI4eTLHw0EqlGNPzXA_UntQmHThWuSkHImL_zw6eC5ItbV45m5s3Q';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = '/';
    } catch (error) {
      toast.error(error.message === 'Invalid login credentials'
        ? 'Email ou senha incorretos'
        : 'Erro ao fazer login: ' + error.message);
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Digite seu email primeiro');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login'
      });
      if (error) throw error;
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
      setIsResetMode(false);
    } catch (error) {
      toast.error('Erro ao enviar email: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#fbf9fa] text-[#1b1c1d] min-h-screen flex items-center justify-center p-4 md:p-8">
      <main className="w-full max-w-6xl flex bg-white rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(227,24,24,0.08)]">
        {/* Left Side: Hero Area (Hidden on Mobile) */}
        <section className="hidden lg:flex lg:w-3/5 relative bg-gradient-to-br from-[#fff5f5] to-white p-16 flex-col justify-between overflow-hidden">
          {/* Background Decorative Pattern */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(227, 24, 24, 0.05) 1px, transparent 0)',
              backgroundSize: '24px 24px'
            }}
          />
          {/* Abstract Pasta Shapes (Geometric Illustration) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-20">
            <svg className="w-full h-full" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
              <circle className="text-[#e31818]" cx="100" cy="100" r="40" fill="none" stroke="currentColor" strokeWidth="2" />
              <rect className="text-[#B8860B]" x="250" y="50" width="60" height="60" rx="12" fill="none" stroke="currentColor" strokeWidth="2" />
              <path className="text-[#e31818]" d="M50 300 Q100 250 150 300 T250 300" fill="none" stroke="currentColor" strokeWidth="2" />
              <path className="text-[#B8860B]" d="M300 200 L340 240 M340 200 L300 240" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-12">
              <img
                src={LOGO_URL}
                alt="Maxi Massas Logo"
                className="h-12 w-auto object-contain"
              />
              <span className="text-xl font-extrabold tracking-tighter text-[#1b1c1d]">Maxi Massas</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#1b1c1d] tracking-tight leading-[1.15] max-w-md" style={{ fontFamily: "'Inter', sans-serif" }}>
              Gestão inteligente para sua franquia de massas artesanais
            </h1>
          </div>

          {/* Floating Stat Cards */}
          <div className="relative z-10 grid grid-cols-1 gap-4 w-fit">
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-[#bccac0]/10 flex items-center gap-4 translate-x-4">
              <div className="w-10 h-10 rounded-full bg-[#e31818]/10 flex items-center justify-center text-[#e31818]">
                <MaterialIcon icon="payments" size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#3d4a42] font-semibold">Faturamento Diário</p>
                <p className="text-lg font-bold text-[#1b1c1d]">R$ 4.850</p>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-[#bccac0]/10 flex items-center gap-4 translate-x-12">
              <div className="w-10 h-10 rounded-full bg-[#B8860B]/10 flex items-center justify-center text-[#B8860B]">
                <MaterialIcon icon="shopping_basket" size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#3d4a42] font-semibold">Pedidos Hoje</p>
                <p className="text-lg font-bold text-[#1b1c1d]">32 vendas</p>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-[#bccac0]/10 flex items-center gap-4 translate-x-8">
              <div className="w-10 h-10 rounded-full bg-[#6b38d4]/10 flex items-center justify-center text-[#6b38d4]">
                <MaterialIcon icon="fact_check" size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#3d4a42] font-semibold">Qualidade</p>
                <p className="text-lg font-bold text-[#1b1c1d]">96% checklist</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Login Form */}
        <section className="w-full lg:w-2/5 p-8 md:p-16 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            {/* Mobile Logo */}
            <div className="lg:hidden flex justify-center mb-8">
              <img
                src={LOGO_URL}
                alt="Maxi Massas Logo"
                className="h-20 w-auto"
              />
            </div>

            <div className="mb-10 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-[#e31818] tracking-tight mb-2">Maxi Massas</h2>
              <p className="text-[#3d4a42]">
                {isResetMode ? 'Recuperar senha' : 'Acesse sua franquia'}
              </p>
            </div>

            <form onSubmit={isResetMode ? handleResetPassword : handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-[#3d4a42] ml-1">
                  E-mail
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 bg-[#e9e8e9] rounded-xl border-none focus:ring-2 focus:ring-[#e31818]/20 transition-all text-[#1b1c1d] placeholder:text-[#6d7a72]/60 outline-none"
                  />
                </div>
              </div>

              {!isResetMode && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label htmlFor="password" className="block text-sm font-medium text-[#3d4a42]">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsResetMode(true)}
                      className="text-sm font-semibold text-[#e31818] hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3.5 bg-[#e9e8e9] rounded-xl border-none focus:ring-2 focus:ring-[#e31818]/20 transition-all text-[#1b1c1d] placeholder:text-[#6d7a72]/60 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#3d4a42] hover:text-[#e31818] transition-colors"
                    >
                      {showPassword ? <MaterialIcon icon="visibility_off" size={20} /> : <MaterialIcon icon="visibility" size={20} />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-[#e31818] text-white font-bold rounded-xl shadow-lg shadow-[#e31818]/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading ? 'Aguarde...' : isResetMode ? 'Enviar email de recuperação' : 'Entrar'}
              </button>

              {isResetMode && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsResetMode(false)}
                    className="text-sm font-semibold text-[#e31818] hover:underline"
                  >
                    Voltar ao login
                  </button>
                </div>
              )}

            </form>

            <div className="mt-12 text-center">
              <p className="text-sm text-[#3d4a42]">
                Não possui acesso?{' '}
                <span className="text-[#e31818] font-bold hover:underline cursor-pointer">Solicite ao administrador</span>
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Meta */}
      <footer className="fixed bottom-6 left-0 right-0 flex justify-center opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[10px] tracking-widest uppercase font-bold text-[#1b1c1d]">
          Digital Atélier &copy; 2024 Maxi Massas Franchise System
        </p>
      </footer>
    </div>
  );
}
