import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import MaterialIcon from "@/components/ui/MaterialIcon";
import logoMaxiMassas from "@/assets/logo-maxi-massas-optimized.png";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import AuthHero from "@/components/auth/AuthHero";

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const isLockedOut = lockoutSeconds > 0;

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setTimeout(() => {
      setLockoutSeconds((s) => s - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [lockoutSeconds]);

  const startLockout = useCallback(() => {
    setLockoutSeconds(60);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLockedOut) return;
    setIsLoading(true);

    // Safety: never stay loading forever (AuthContext global spinner takes over)
    const safetyTimer = setTimeout(() => setIsLoading(false), 10000);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setFailedAttempts(0);
      // Reset local loading — AuthContext.onAuthStateChange('SIGNED_IN') takes over
      setIsLoading(false);
    } catch (error) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 5) {
        startLockout();
        toast.error('Muitas tentativas. Aguarde 60 segundos.');
      } else {
        toast.error(safeErrorMessage(error, "Erro ao fazer login."));
      }
      setIsLoading(false);
    } finally {
      clearTimeout(safetyTimer);
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
        redirectTo: window.location.origin + '/set-password'
      });
      if (error) throw error;
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
      setIsResetMode(false);
    } catch (error) {
      toast.error(safeErrorMessage(error, "Erro ao enviar email de recuperação."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#fbf9fa] text-[#1b1c1d] min-h-[100dvh] flex flex-col items-center justify-center p-4 md:p-8">
      <main className="w-full max-w-6xl flex bg-white rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(227,24,24,0.08)]">
        <AuthHero
          headline={
            <>
              Gestão inteligente para sua <span className="text-[#e31818]">franquia</span> de massas artesanais
            </>
          }
          subtitle="Vendas, estoque, financeiro e o robô vendedor — tudo num lugar só."
        />

        {/* Right Side: Login Form */}
        <section className="w-full lg:w-2/5 p-6 md:p-16 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            {/* Mobile Logo */}
            <div className="lg:hidden flex justify-center mb-6">
              <img
                src={logoMaxiMassas}
                alt="Maxi Massas Logo"
                className="h-16 w-auto"
              />
            </div>

            <div className="mb-6 md:mb-10 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-[#1b1c1d] tracking-tight mb-2">
                {isResetMode ? 'Recuperar senha' : 'Bem-vindo de volta'}
              </h2>
              <p className="text-[#3d4a42]">
                {isResetMode ? 'Enviaremos um link para você redefinir a senha' : 'Acesse o painel da sua franquia'}
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
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#3d4a42] hover:text-[#e31818] transition-colors"
                    >
                      {showPassword ? <MaterialIcon icon="visibility_off" size={20} /> : <MaterialIcon icon="visibility" size={20} />}
                    </button>
                  </div>
                </div>
              )}

              {isLockedOut && !isResetMode && (
                <p className="text-sm text-[#e31818] text-center font-medium">
                  Muitas tentativas. Aguarde {lockoutSeconds} segundos.
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading || (isLockedOut && !isResetMode)}
                className="w-full h-12 bg-[#e31818] text-white font-bold rounded-xl shadow-lg shadow-[#e31818]/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:bg-[#e5e3e4] disabled:text-[#9a9394] disabled:shadow-none disabled:cursor-not-allowed"
              >
                {isLoading ? 'Aguarde...' : isResetMode ? 'Enviar email de recuperação' : isLockedOut ? `Aguarde ${lockoutSeconds}s` : 'Entrar'}
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

            <div className="mt-6 md:mt-12 text-center space-y-2">
              <p className="text-sm text-[#3d4a42]">
                Primeiro acesso?{' '}
                <button
                  type="button"
                  onClick={() => {
                    if (!email) {
                      toast.error('Digite seu email primeiro');
                      return;
                    }
                    setIsResetMode(true);
                  }}
                  className="text-[#e31818] font-bold hover:underline"
                >
                  Defina sua senha aqui
                </button>
              </p>
              <p className="text-xs text-[#4a3d3d]">
                Não possui acesso? Solicite ao administrador
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Meta */}
      <footer className="mt-4 md:fixed md:bottom-6 md:left-0 md:right-0 flex justify-center opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[10px] tracking-widest uppercase font-bold text-[#1b1c1d]">
          &copy; 2026 Maxi Massas
        </p>
      </footer>
    </div>
  );
}
