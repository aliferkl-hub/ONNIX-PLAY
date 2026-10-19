import React, { useState } from 'react';
import {
  Shield,
  KeyRound,
  Lock,
  Mail,
  User,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { DEFAULT_MASTER_EMAIL } from '../../lib/db.ts';

export const LoginView: React.FC = () => {
  const {
    loginWithGoogle,
    loginMasterWithPassword,
    loginEmployeeWithCredentials,
    setupMasterOwnerPassword,
    masterCredentialsConfigured,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'master' | 'employee' | 'first_setup'>('master');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code2fa, setCode2fa] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showRecoveryInfo, setShowRecoveryInfo] = useState(false);

  // Handle first-time setup for Master Owner
  const handleSetupMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('A senha deve possuir pelo menos 8 caracteres para proteção da conta Master.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    const res = await setupMasterOwnerPassword(password, securityAnswer);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Erro ao configurar conta Master Owner.');
    } else {
      setSuccessMsg('Master Owner configurado com sucesso com hash criptográfico!');
    }
  };

  // Handle Master Owner login with password
  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await loginMasterWithPassword(password, code2fa);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Erro na autenticação.');
    }
  };

  // Handle Employee login
  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await loginEmployeeWithCredentials(email, password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Erro na autenticação de funcionário.');
    }
  };

  // Handle Google Auth
  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Falha ao autenticar com o Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060a14] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-600/10 via-blue-600/10 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Brand Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 p-0.5 shadow-xl shadow-cyan-500/20 mb-4">
            <div className="w-full h-full bg-[#080d1a] rounded-[14px] flex items-center justify-center">
              <Zap className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wider flex items-center justify-center gap-2">
            ONNIX <span className="text-cyan-400">PLAY</span>
          </h1>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mt-1">
            SISTEMA DE GESTÃO EMPRESARIAL
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/50 backdrop-blur-md">
          {/* Tabs */}
          <div className="flex p-1 bg-slate-900/80 rounded-xl mb-6 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('master');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'master'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Master Owner
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('employee');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'employee'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Funcionário
            </button>
            {!masterCredentialsConfigured && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('first_setup');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'first_setup'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow'
                    : 'text-purple-400 hover:text-purple-300 animate-pulse'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                1º Acesso
              </button>
            )}
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: MASTER OWNER LOGIN */}
          {activeTab === 'master' && (
            <form onSubmit={handleMasterLogin} className="space-y-4">
              <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                  Conta Administrativa Principal
                </span>
                <span className="text-xs font-semibold text-white">{DEFAULT_MASTER_EMAIL}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Senha do Master Owner
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Digite sua senha cadastrada"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              {/* 2FA optional input */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center justify-between">
                  <span>Código 2FA (se ativado)</span>
                  <span className="text-[10px] text-slate-500">Ex: 123456</span>
                </label>
                <input
                  type="text"
                  value={code2fa}
                  onChange={e => setCode2fa(e.target.value)}
                  placeholder="Código de 6 dígitos"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Validando Credenciais...' : 'Entrar como Master Owner'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowRecoveryInfo(!showRecoveryInfo)}
                  className="text-xs text-slate-400 hover:text-cyan-400 flex items-center justify-center gap-1 mx-auto"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Esqueceu a senha do Master Owner?
                </button>
                {showRecoveryInfo && (
                  <p className="mt-2 text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                    A recuperação é realizada pelo e-mail autorizado ({DEFAULT_MASTER_EMAIL}) ou autenticação direta com o Google.
                  </p>
                )}
              </div>
            </form>
          )}

          {/* TAB 2: EMPLOYEE LOGIN */}
          {activeTab === 'employee' && (
            <form onSubmit={handleEmployeeLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  E-mail do Funcionário
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Código de Acesso / Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Código fornecido pelo Master"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Acessando...' : 'Acessar Área Restrita'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-[11px] text-slate-500 text-center">
                Apenas funcionários cadastrados e ativos pelo Master Owner têm acesso.
              </p>
            </form>
          )}

          {/* TAB 3: FIRST SETUP (INITIAL PASSWORD CREATION FOR MASTER OWNER) */}
          {activeTab === 'first_setup' && (
            <form onSubmit={handleSetupMaster} className="space-y-4">
              <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                  Configuração Inicial de Segurança
                </span>
                <p className="text-xs text-slate-300 mt-0.5">
                  Defina a senha mestra para <strong className="text-white">{DEFAULT_MASTER_EMAIL}</strong>. A senha será armazenada usando hash criptográfico PBKDF2/SHA-256 com salt.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nova Senha Forte (mínimo 8 caracteres)
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Ex: Onnix@Master2026#"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirme a Nova Senha
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Palavra-chave de Recuperação de Emergência
                </label>
                <input
                  type="text"
                  value={securityAnswer}
                  onChange={e => setSecurityAnswer(e.target.value)}
                  placeholder="Ex: onnix-seguranca-2026"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Gravando Credenciais...' : 'Gravar Senha e Inicializar Master'}
                <KeyRound className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Divider & Google Login option */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="relative flex py-2 items-center mb-3">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Ou Autenticar com Google
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800/90 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700/80 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Entrar com Conta Google</span>
            </button>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-center text-slate-500">
          ONNIX PLAY &copy; 2026. Todos os acessos são criptografados e auditados.
        </p>
      </div>
    </div>
  );
};
