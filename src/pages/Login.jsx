import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import MaterialIcon from "@/components/ui/MaterialIcon";
import logoMaxiMassas from "@/assets/logo-maxi-massas-optimized.png";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import AuthHero from "@/components/auth/AuthHero";

// Autofill de celular pode deixar espaco/maiuscula no e-mail. No reset, e-mail que nao casa
// com nenhum usuario devolve 200 vazio e NENHUM email e enviado (anti-enumeracao do Supabase).
const normalizeEmail = (value) => (value || '').trim().toLowerCase();

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [showLinkError, setShowLinkError] = useState(false);

  const isLockedOut = lockoutSeconds > 0;

  // Aviso de link de convite/recuperação vencido ou já usado — a flag é gravada pelo
  // AuthContext (ver auth_link_error) quando o /set-password chega com ?error=... ou
  // #error=... na URL. Dispara o evento de exibição só 1x, ao montar.
  useEffect(() => {
    if (sessionStorage.getItem('auth_link_error')) {
      setShowLinkError(true);
      try {
        window.clarity?.('event', 'link_vencido_exibido');
      } catch {
        // Analytics nunca pode travar a tela
      }
    }
  }, []);

  const dismissLinkError = useCallback(() => {
    sessionStorage.removeItem('auth_link_error');
    setShowLinkError(false);
  }, []);

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
      const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
      if (error) throw error;
      setFailedAttempts(0);
      sessionStorage.removeItem('auth_link_error');
      setShowLinkError(false);
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
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) {
      toast.error('Digite seu email primeiro');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin + '/set-password'
      });
      if (error) throw error;
      // O Supabase responde sucesso mesmo para e-mail que nao existe, entao NUNCA afirmar
      // que foi enviado — mostrar o endereco usado para a pessoa conferir o que digitou.
      toast.success(`Se ${cleanEmail} estiver cadastrado, o link chega em alguns minutos.`, {
        description: 'Não chegou? Confira se é o mesmo e-mail que recebeu o convite do painel.',
        duration: 12000
      });
      setIsResetMode(false);
    } catch (error) {
      toast.error(safeErrorMessage(error, "Erro ao enviar email de recuperação."));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrimeiroAcesso = () => {
    if (!email) {
      toast.error('Digite seu email primeiro');
      return;
    }
    setIsResetMode(true);
  };

  return (
    <div className="bg-surface text-ink min-h-[100dvh] flex flex-col lg:items-center lg:justify-center lg:p-8">
      {/* Faixa vermelha "cozinha de massa fresca" — só mobile. No desktop o AuthHero
          cumpre esse papel de vitrine, então a faixa some (lg:hidden). */}
      <div className="lg:hidden bg-brand bg-farinha px-6 pt-12 pb-16 flex flex-col gap-4">
        <div className="self-start bg-white rounded-2xl px-3 py-2">
          <img src={logoMaxiMassas} alt="Maxi Massas" className="h-9 w-auto block" />
        </div>
        <div>
          <h1 className="font-plus-jakarta font-extrabold text-[28px] leading-[1.15] tracking-tight text-white">
            Sua unidade<br />na palma da mão.
          </h1>
          <p className="mt-2 text-base leading-snug text-white/90">
            Vendas, estoque e clientes num lugar só.
          </p>
        </div>
      </div>

      <main className="w-full lg:max-w-6xl lg:flex lg:bg-white lg:rounded-3xl lg:overflow-hidden lg:shadow-[0_20px_50px_rgba(220,38,38,0.08)]">
        <AuthHero
          headline={
            <>
              Gestão inteligente para sua <span className="text-err">franquia</span> de massas artesanais
            </>
          }
          subtitle="Vendas, estoque, financeiro e o robô vendedor — tudo num lugar só."
        />

        {/* Right Side: Login Form — no mobile, cartão branco sobreposto à faixa vermelha
            (margem negativa); no desktop, painel do layout de duas colunas. */}
        <section className="w-full lg:w-2/5 px-4 -mt-12 lg:mt-0 lg:px-16 lg:py-16 pb-10 lg:pb-0 flex flex-col lg:justify-center">
          <div className="w-full max-w-md mx-auto bg-white rounded-3xl lg:rounded-none shadow-[0_16px_40px_rgba(41,23,21,0.12)] lg:shadow-none p-5 lg:p-0 flex flex-col gap-4">
            {showLinkError && (
              <div
                role="status"
                className="flex items-start gap-3 bg-warn-soft text-warn-ink rounded-2xl p-3"
              >
                <MaterialIcon icon="info" size={20} className="mt-0.5 shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold">Esse link já foi usado ou venceu.</p>
                  <p>Entre com seu e-mail e senha. Ainda não tem senha? Digite seu e-mail e toque em Primeiro acesso.</p>
                </div>
                <button
                  type="button"
                  onClick={dismissLinkError}
                  aria-label="Fechar aviso"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-warn-ink/70 hover:text-warn-ink transition-colors -mt-1 -mr-1"
                >
                  <MaterialIcon icon="close" size={18} />
                </button>
              </div>
            )}

            <div>
              <h2 className="font-plus-jakarta font-extrabold text-2xl lg:text-3xl tracking-tight text-ink">
                {isResetMode ? 'Recuperar senha' : 'Entrar'}
              </h2>
              <p className="mt-1 text-[15px] lg:text-base text-ink-2">
                {isResetMode ? 'Enviaremos um link para você redefinir a senha' : 'Acesse o painel da sua franquia'}
              </p>
            </div>

            <form onSubmit={isResetMode ? handleResetPassword : handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-[15px] font-semibold text-ink-2">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-[52px] px-4 bg-surface rounded-2xl border border-surface-line focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all text-[17px] text-ink placeholder:text-ink-3 outline-none"
                />
              </div>

              {!isResetMode && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="password" className="text-[15px] font-semibold text-ink-2">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsResetMode(true)}
                      className="min-h-[44px] text-[15px] font-semibold text-brand hover:underline"
                    >
                      Esqueci a senha
                    </button>
                  </div>
                  <div className="relative flex">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="flex-grow h-[52px] pl-4 pr-14 bg-surface rounded-2xl border border-surface-line focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all text-[17px] text-ink placeholder:text-ink-3 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-1 top-1 h-11 w-11 flex items-center justify-center rounded-xl text-ink-3 hover:text-brand transition-colors"
                    >
                      <MaterialIcon icon={showPassword ? 'visibility_off' : 'visibility'} size={20} />
                    </button>
                  </div>
                </div>
              )}

              {isLockedOut && !isResetMode && (
                <p className="text-sm text-err text-center font-medium">
                  Muitas tentativas. Aguarde {lockoutSeconds} segundos.
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading || (isLockedOut && !isResetMode)}
                className="h-14 rounded-2xl bg-brand text-white font-bold text-[17px] shadow-lg shadow-brand/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:bg-ink-4 disabled:text-white/70 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {isLoading ? 'Aguarde...' : isResetMode ? 'Enviar email de recuperação' : isLockedOut ? `Aguarde ${lockoutSeconds}s` : 'Entrar'}
              </button>

              {isResetMode && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsResetMode(false)}
                    className="text-[15px] font-semibold text-brand hover:underline"
                  >
                    Voltar ao login
                  </button>
                </div>
              )}
            </form>

            {!isResetMode && (
              <>
                <div className="flex items-center gap-3 text-ink-3 text-sm">
                  <span className="flex-1 h-px bg-surface-line" aria-hidden="true" />
                  ou
                  <span className="flex-1 h-px bg-surface-line" aria-hidden="true" />
                </div>

                <button
                  type="button"
                  onClick={handlePrimeiroAcesso}
                  className="h-[52px] rounded-2xl border-[1.5px] border-brand text-brand font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-brand-soft transition-colors"
                >
                  <MaterialIcon icon="mail" size={20} />
                  Primeiro acesso? Receber link
                </button>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-ink-3 max-w-md mx-auto w-full px-1">
            Não tem acesso? Fale com a equipe Maxi Massas.
          </p>
        </section>
      </main>

      {/* Footer Meta */}
      <footer className="mt-4 lg:fixed lg:bottom-6 lg:left-0 lg:right-0 flex justify-center opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[10px] tracking-widest uppercase font-bold text-ink">
          &copy; 2026 Maxi Massas
        </p>
      </footer>
    </div>
  );
}
