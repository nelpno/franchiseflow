import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MaterialIcon from "@/components/ui/MaterialIcon";

const LOGO_URL = 'https://lh3.googleusercontent.com/aida/ADBb0ugCTVY4RLjpZaVmTunw5aAOVsOWhVE1VFKJ6dJHWLlp0NQfYLn9e4nf9xumxgvXGuTESxzw_4nnRZgPRRibxsHY0CyQlUftQtsLyFxxoLXrjZ9yh6wRWly1I5gyuQoTheiTmM0sVUrURcN8eyeGxJOyzmOT72i8UzXFg-evAPSA6UvoOVQd-kWWxbtTNct5HKj-ohG7BatXZ9fA1b31kExHOSI4eTLHw0EqlGNPzXA_UntQmHThWuSkHImL_zw6eC5ItbV45m5s3Q';

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { clearPasswordSetup } = useAuth();
  const navigate = useNavigate();

  const isRecovery = localStorage.getItem('password_setup_type') === 'recovery';

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success(isRecovery ? 'Senha redefinida com sucesso!' : 'Senha criada com sucesso! Bem-vindo!');
      clearPasswordSetup();
      localStorage.removeItem('password_setup_type');
      navigate('/');
    } catch (error) {
      toast.error('Erro ao definir senha: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#fbf9fa] text-[#1b1c1d] min-h-screen flex items-center justify-center p-4 md:p-8">
      <main className="w-full max-w-6xl flex bg-white rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(227,24,24,0.08)]">
        {/* Left Side: Hero Area (Hidden on Mobile) */}
        <section className="hidden lg:flex lg:w-3/5 relative bg-gradient-to-br from-[#fff5f5] to-white p-16 flex-col justify-between overflow-hidden">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(227, 24, 24, 0.05) 1px, transparent 0)',
              backgroundSize: '24px 24px'
            }}
          />
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
              <img src={LOGO_URL} alt="Maxi Massas Logo" className="h-12 w-auto object-contain" />
              <span className="text-xl font-extrabold tracking-tighter text-[#1b1c1d]">Maxi Massas</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#1b1c1d] tracking-tight leading-[1.15] max-w-md" style={{ fontFamily: "'Inter', sans-serif" }}>
              {isRecovery
                ? 'Redefina sua senha e volte a gerenciar sua franquia'
                : 'Bem-vindo à família Maxi Massas!'
              }
            </h1>
          </div>

          <div className="relative z-10 grid grid-cols-1 gap-4 w-fit">
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-[#bccac0]/10 flex items-center gap-4 translate-x-4">
              <div className="w-10 h-10 rounded-full bg-[#e31818]/10 flex items-center justify-center text-[#e31818]">
                <MaterialIcon icon="lock" size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#3d4a42] font-semibold">Segurança</p>
                <p className="text-lg font-bold text-[#1b1c1d]">Seus dados protegidos</p>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-[#bccac0]/10 flex items-center gap-4 translate-x-12">
              <div className="w-10 h-10 rounded-full bg-[#B8860B]/10 flex items-center justify-center text-[#B8860B]">
                <MaterialIcon icon="storefront" size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#3d4a42] font-semibold">Sua Franquia</p>
                <p className="text-lg font-bold text-[#1b1c1d]">Gestão completa</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Set Password Form */}
        <section className="w-full lg:w-2/5 p-8 md:p-16 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            {/* Mobile Logo */}
            <div className="lg:hidden flex justify-center mb-8">
              <img src={LOGO_URL} alt="Maxi Massas Logo" className="h-20 w-auto" />
            </div>

            <div className="mb-10 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-[#e31818] tracking-tight mb-2">
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
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
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

              <div className="h-5">
                {password && password.length < 6 && (
                  <p className="text-sm text-[#e31818]/70 ml-1 flex items-center gap-1.5">
                    <MaterialIcon icon="info" size={16} />
                    A senha deve ter pelo menos 6 caracteres
                  </p>
                )}
                {password && confirmPassword && password !== confirmPassword && password.length >= 6 && (
                  <p className="text-sm text-[#e31818]/70 ml-1 flex items-center gap-1.5">
                    <MaterialIcon icon="warning" size={16} />
                    As senhas não coincidem
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || password.length < 6 || password !== confirmPassword}
                className="w-full h-12 bg-[#e31818] text-white font-bold rounded-xl shadow-lg shadow-[#e31818]/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading ? 'Aguarde...' : isRecovery ? 'Redefinir senha' : 'Criar senha e entrar'}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-6 left-0 right-0 flex justify-center opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[10px] tracking-widest uppercase font-bold text-[#1b1c1d]">
          Digital Atélier &copy; 2024 Maxi Massas Franchise System
        </p>
      </footer>
    </div>
  );
}
