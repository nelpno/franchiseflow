import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MaterialIcon from "@/components/ui/MaterialIcon";
import logoMaxiMassas from "@/assets/logo-maxi-massas-optimized.png";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import AuthHero from "@/components/auth/AuthHero";

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { clearPasswordSetup } = useAuth();
  const navigate = useNavigate();

  const isRecovery = sessionStorage.getItem('password_setup_type') === 'recovery';

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasMinLength = password.length >= 8;
  const isPasswordValid = hasUppercase && hasLowercase && hasNumber && hasMinLength;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast.error('A senha deve ter pelo menos 8 caracteres, com maiuscula, minuscula e numero');
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
      navigate(isRecovery ? '/' : '/OnboardingWelcome');
    } catch (error) {
      toast.error(safeErrorMessage(error, "Erro ao definir senha."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#fbf9fa] text-[#1b1c1d] min-h-[100dvh] flex flex-col items-center justify-center p-4 md:p-8">
      <main className="w-full max-w-6xl flex bg-white rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(227,24,24,0.08)]">
        <AuthHero
          headline={
            isRecovery ? (
              <>
                Redefina sua senha e volte a <span className="text-[#e31818]">gerenciar</span> sua franquia
              </>
            ) : (
              <>
                Bem-vindo à <span className="text-[#e31818]">família</span> Maxi Massas!
              </>
            )
          }
          subtitle={
            isRecovery
              ? "Escolha uma nova senha para retomar o acesso ao seu painel."
              : "Falta só criar sua senha para começar a gerenciar sua franquia."
          }
        />

        {/* Right Side: Set Password Form */}
        <section className="w-full lg:w-2/5 p-8 md:p-16 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            {/* Mobile Logo */}
            <div className="lg:hidden flex justify-center mb-8">
              <img src={logoMaxiMassas} alt="Maxi Massas Logo" className="h-20 w-auto" />
            </div>

            <div className="mb-10 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-[#1b1c1d] tracking-tight mb-2">
                {isRecovery ? 'Redefinir senha' : 'Crie sua senha'}
              </h2>
              <p className="text-[#3d4a42]">
                {isRecovery
                  ? 'Digite sua nova senha abaixo'
                  : 'Defina uma senha para acessar sua franquia'
                }
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-[#3d4a42] ml-1">
                  {isRecovery ? 'Nova senha' : 'Senha'}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
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

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#3d4a42] ml-1">
                  Confirme a senha
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite novamente"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 bg-[#e9e8e9] rounded-xl border-none focus:ring-2 focus:ring-[#e31818]/20 transition-all text-[#1b1c1d] placeholder:text-[#6d7a72]/60 outline-none"
                  />
                </div>
              </div>

              <div className="min-h-[20px]">
                {password && !isPasswordValid && (
                  <div className="text-sm ml-1 space-y-0.5">
                    <p className={`flex items-center gap-1.5 ${hasMinLength ? 'text-green-600' : 'text-[#e31818]/70'}`}>
                      <MaterialIcon icon={hasMinLength ? 'check_circle' : 'info'} size={14} />
                      8 caracteres
                    </p>
                    <p className={`flex items-center gap-1.5 ${hasUppercase ? 'text-green-600' : 'text-[#e31818]/70'}`}>
                      <MaterialIcon icon={hasUppercase ? 'check_circle' : 'info'} size={14} />
                      1 letra maiuscula
                    </p>
                    <p className={`flex items-center gap-1.5 ${hasLowercase ? 'text-green-600' : 'text-[#e31818]/70'}`}>
                      <MaterialIcon icon={hasLowercase ? 'check_circle' : 'info'} size={14} />
                      1 letra minuscula
                    </p>
                    <p className={`flex items-center gap-1.5 ${hasNumber ? 'text-green-600' : 'text-[#e31818]/70'}`}>
                      <MaterialIcon icon={hasNumber ? 'check_circle' : 'info'} size={14} />
                      1 numero
                    </p>
                  </div>
                )}
                {password && isPasswordValid && confirmPassword && password !== confirmPassword && (
                  <p className="text-sm text-[#e31818]/70 ml-1 flex items-center gap-1.5">
                    <MaterialIcon icon="warning" size={16} />
                    As senhas nao coincidem
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !isPasswordValid || password !== confirmPassword}
                className="w-full h-12 bg-[#e31818] text-white font-bold rounded-xl shadow-lg shadow-[#e31818]/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:bg-[#e5e3e4] disabled:text-[#9a9394] disabled:shadow-none disabled:cursor-not-allowed"
              >
                {isLoading ? 'Aguarde...' : isRecovery ? 'Redefinir senha' : 'Criar senha e entrar'}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-6 left-0 right-0 flex justify-center opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[10px] tracking-widest uppercase font-bold text-[#1b1c1d]">
          &copy; 2026 Maxi Massas
        </p>
      </footer>
    </div>
  );
}
