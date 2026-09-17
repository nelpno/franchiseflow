import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MaterialIcon from "@/components/ui/MaterialIcon";
import logoMaxiMassas from "@/assets/logo-maxi-massas-optimized.png";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import AuthHero from "@/components/auth/AuthHero";

// Uma regra por linha do check-ao-vivo: circulo verde com check quando `ok`, circulo
// cinza vazio quando nao. Cor do texto some (`text-ink-3`) ate a regra passar.
function PasswordRequirement({ ok, label }) {
  return (
    <div className={`flex items-center gap-2.5 text-[15px] ${ok ? 'font-semibold text-ok-ink' : 'font-medium text-ink-3'}`}>
      {ok ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok text-white">
          <MaterialIcon icon="check" size={15} />
        </span>
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full border-2 border-ink-4" aria-hidden="true" />
      )}
      {label}
    </div>
  );
}

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { clearPasswordSetup, user } = useAuth();
  const navigate = useNavigate();

  const isRecovery = sessionStorage.getItem('password_setup_type') === 'recovery';

  // Regra nova (16/09/2026): 8+ caracteres, letra e número — sem exigir maiúscula e
  // minúscula (o servidor nunca exigiu; a tela antiga travava mais que o backend).
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasLetter && hasNumber;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast.error('A senha deve ter pelo menos 8 caracteres, com letras e números');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } });
      if (error) throw error;

      toast.success(isRecovery ? 'Senha redefinida com sucesso!' : 'Senha criada com sucesso! Bem-vindo!');
      clearPasswordSetup();
      sessionStorage.removeItem('password_setup_type');
      // Só franqueado passa pelo onboarding guiado; admin/gerente/CS (e papel ainda
      // desconhecido, caso o perfil não tenha carregado a tempo) vão direto pro painel —
      // o Layout já redireciona franqueado novo pras boas-vindas quando é o caso.
      const isFranchisee = user?.role === 'franchisee';
      navigate(isRecovery ? '/' : (isFranchisee ? '/OnboardingWelcome' : '/'));
    } catch (error) {
      toast.error(safeErrorMessage(error, "Erro ao definir senha."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface text-ink min-h-[100dvh] flex flex-col lg:items-center lg:justify-center lg:p-8">
      {/* Faixa vermelha "cozinha de massa fresca" — só mobile. No desktop o AuthHero
          cumpre esse papel de vitrine, então a faixa some (lg:hidden). */}
      <div className="lg:hidden bg-brand bg-farinha px-6 pt-10 pb-14 flex flex-col gap-4">
        <div className="self-start bg-white rounded-2xl px-3 py-2">
          <img src={logoMaxiMassas} alt="Maxi Massas" className="h-9 w-auto block" />
        </div>
        <h1 className="font-plus-jakarta font-extrabold text-[26px] leading-[1.2] tracking-tight text-white">
          {isRecovery ? 'Crie uma senha nova' : 'Boas-vindas à família Maxi Massas!'}
        </h1>
      </div>

      <main className="w-full lg:max-w-6xl lg:flex lg:bg-white lg:rounded-3xl lg:overflow-hidden lg:shadow-[0_20px_50px_rgba(220,38,38,0.08)]">
        <AuthHero
          headline={
            isRecovery ? (
              <>
                Redefina sua senha e volte a <span className="text-err">gerenciar</span> sua franquia
              </>
            ) : (
              <>
                Bem-vindo à <span className="text-err">família</span> Maxi Massas!
              </>
            )
          }
          subtitle={
            isRecovery
              ? "Escolha uma nova senha para retomar o acesso ao seu painel."
              : "Falta só criar sua senha para começar a gerenciar sua franquia."
          }
        />

        {/* Right Side: Set Password Form — no mobile, cartão branco sobreposto à faixa
            vermelha (margem negativa); no desktop, painel do layout de duas colunas. */}
        <section className="w-full lg:w-2/5 px-4 -mt-10 lg:mt-0 lg:px-16 lg:py-16 pb-10 lg:pb-0 flex flex-col lg:justify-center">
          <div className="w-full max-w-md mx-auto bg-white rounded-3xl lg:rounded-none shadow-[0_16px_40px_rgba(41,23,21,0.12)] lg:shadow-none p-5 lg:p-0 flex flex-col gap-4">
            <div>
              <h2 className="font-plus-jakarta font-extrabold text-2xl lg:text-3xl tracking-tight text-ink">
                Crie sua senha
              </h2>
              {user?.email && (
                <p className="mt-1 text-[15px] lg:text-base text-ink-2">
                  Você vai entrar com <strong className="text-ink">{user.email}</strong>
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-[15px] font-semibold text-ink-2">
                  Nova senha
                </label>
                <div className="relative flex">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Crie uma senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
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

              {password && (
                <div aria-live="polite" className="flex flex-col gap-2 px-0.5">
                  <PasswordRequirement ok={hasMinLength} label="8 caracteres ou mais" />
                  <PasswordRequirement ok={hasLetter && hasNumber} label="Letras e números" />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-[15px] font-semibold text-ink-2">
                  Repita a senha
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite novamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-[52px] px-4 bg-surface rounded-2xl border border-surface-line focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all text-[17px] text-ink placeholder:text-ink-3 outline-none"
                />
              </div>

              <p aria-live="polite" className="min-h-[20px]">
                {passwordsMismatch && (
                  <span className="text-sm text-err/80 flex items-center gap-1.5">
                    <MaterialIcon icon="warning" size={16} />
                    As senhas não coincidem
                  </span>
                )}
              </p>

              <button
                type="submit"
                disabled={isLoading || !isPasswordValid || password !== confirmPassword}
                className="h-14 rounded-2xl bg-brand text-white font-bold text-[17px] shadow-lg shadow-brand/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:bg-ink-4 disabled:text-white/70 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {isLoading ? 'Aguarde...' : 'Criar senha e entrar'}
              </button>

              <p className="text-sm leading-relaxed text-ink-3 text-center">
                Esqueceu depois? Na tela de entrar, toque em Esqueci a senha.
              </p>
            </form>
          </div>
        </section>
      </main>

      <footer className="mt-4 lg:fixed lg:bottom-6 lg:left-0 lg:right-0 flex justify-center opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[10px] tracking-widest uppercase font-bold text-ink">
          &copy; 2026 Maxi Massas
        </p>
      </footer>
    </div>
  );
}
