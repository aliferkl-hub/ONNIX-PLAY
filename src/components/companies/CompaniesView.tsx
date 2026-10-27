/**
 * Empresas Parceiras Management View (Multiempresa)
 * Exclusive to Master Owner & authorized enterprise managers
 */

import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  AlertTriangle,
  Users,
  GitBranch,
  Edit2,
  Power,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  Layers,
  MapPin,
  Phone,
  Mail,
  X
} from 'lucide-react';
import { PartnerCompany, Branch, Customer, CompanyStatus } from '../../types/index.ts';
import { DatabaseService } from '../../lib/db.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface CompaniesViewProps {
  companies: PartnerCompany[];
  branches: Branch[];
  customers: Customer[];
  onRefresh: () => Promise<void>;
  onNavigateToBranches?: (companyId: string) => void;
}

const AVAILABLE_MODULES = [
  { id: 'dashboard', label: 'Painel Geral' },
  { id: 'clientes', label: 'Gestão de Clientes' },
  { id: 'contratos', label: 'Contratos Digitais' },
  { id: 'filiais', label: 'Gestão de Filiais' },
  { id: 'cobrancas', label: 'Cobranças & Faturas' },
  { id: 'pagamentos', label: 'Histórico de Pagamentos' },
  { id: 'relatorios', label: 'Relatórios & Exportação' },
  { id: 'parceiros', label: 'Parceiros Comerciais' },
  { id: 'whatsapp', label: 'Notificações WhatsApp' },
];

export const CompaniesView: React.FC<CompaniesViewProps> = ({
  companies,
  branches,
  customers,
  onRefresh,
  onNavigateToBranches,
}) => {
  const { currentUser, isMasterOwner, activeCompanyId, setActiveCompanyId } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | CompanyStatus>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<PartnerCompany | null>(null);
  const [suspensionModalCompany, setSuspensionModalCompany] = useState<PartnerCompany | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    corporateName: '',
    tradeName: '',
    cnpj: '',
    contactName: '',
    contactRole: '',
    email: '',
    phone: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    status: 'ativa' as CompanyStatus,
    planContracted: 'Empresarial Pro',
    branchesLimit: 5,
    clientsLimit: 500,
    modulesAllowed: ['dashboard', 'clientes', 'contratos', 'filiais', 'cobrancas'],
    adminEmail: '',
    adminName: '',
    notes: '',
  });

  const openNewCompanyModal = () => {
    setEditingCompany(null);
    const nextNum = companies.length + 1;
    const nextCode = `EMP-${String(nextNum).padStart(3, '0')}`;
    setFormData({
      code: nextCode,
      corporateName: '',
      tradeName: '',
      cnpj: '',
      contactName: '',
      contactRole: 'Diretor / Gestor Geral',
      email: '',
      phone: '',
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: 'SP',
      status: 'ativa',
      planContracted: 'Empresarial Pro',
      branchesLimit: 5,
      clientsLimit: 500,
      modulesAllowed: ['dashboard', 'clientes', 'contratos', 'filiais', 'cobrancas'],
      adminEmail: '',
      adminName: '',
      notes: '',
    });
    setErrorMsg('');
    setModalOpen(true);
  };

  const openEditModal = (comp: PartnerCompany) => {
    setEditingCompany(comp);
    setFormData({
      code: comp.code,
      corporateName: comp.corporateName,
      tradeName: comp.tradeName,
      cnpj: comp.cnpj,
      contactName: comp.contactName,
      contactRole: comp.contactRole || 'Diretor',
      email: comp.email,
      phone: comp.phone,
      cep: comp.cep || '',
      street: comp.street || '',
      number: comp.number || '',
      complement: comp.complement || '',
      neighborhood: comp.neighborhood || '',
      city: comp.city || '',
      state: comp.state || 'SP',
      status: comp.status,
      planContracted: comp.planContracted,
      branchesLimit: comp.branchesLimit || 5,
      clientsLimit: comp.clientsLimit || 500,
      modulesAllowed: comp.modulesAllowed || ['dashboard', 'clientes', 'contratos'],
      adminEmail: comp.adminEmail,
      adminName: comp.adminName,
      notes: comp.notes || '',
    });
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tradeName.trim()) {
      setErrorMsg('O Nome Fantasia é obrigatório.');
      return;
    }
    if (!formData.adminEmail.trim()) {
      setErrorMsg('O E-mail do Administrador da empresa é obrigatório.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      if (editingCompany) {
        await DatabaseService.updateCompany(
          editingCompany.id,
          {
            ...formData,
            updatedAt: new Date().toISOString(),
          },
          currentUser?.email || 'master@onnix.com'
        );
        setSuccessMsg(`Empresa "${formData.tradeName}" atualizada com sucesso!`);
      } else {
        await DatabaseService.createCompany(
          formData,
          currentUser?.email || 'master@onnix.com'
        );
        setSuccessMsg(`Empresa "${formData.tradeName}" cadastrada com sucesso!`);
      }
      setModalOpen(false);
      await onRefresh();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar empresa.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (comp: PartnerCompany) => {
    if (comp.status === 'suspensa') {
      // Reactivate
      try {
        await DatabaseService.updateCompany(
          comp.id,
          { status: 'ativa' },
          currentUser?.email || 'master@onnix.com'
        );
        setSuccessMsg(`Empresa "${comp.tradeName}" reativada com sucesso!`);
        await onRefresh();
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err: any) {
        alert(err.message || 'Erro ao reativar empresa.');
      }
    } else {
      // Open suspension modal
      setSuspensionModalCompany(comp);
      setSuspensionReason('Bloqueio administrativo temporário');
    }
  };

  const confirmSuspension = async () => {
    if (!suspensionModalCompany) return;
    try {
      await DatabaseService.updateCompany(
        suspensionModalCompany.id,
        {
          status: 'suspensa',
          notes: `${suspensionModalCompany.notes || ''}\n[SUSPENSÃO EM ${new Date().toLocaleDateString('pt-BR')}]: ${suspensionReason}`.trim(),
        },
        currentUser?.email || 'master@onnix.com'
      );
      setSuccessMsg(`Empresa "${suspensionModalCompany.tradeName}" foi suspensa com sucesso.`);
      setSuspensionModalCompany(null);
      await onRefresh();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao suspender empresa.');
    }
  };

  const toggleModule = (modId: string) => {
    setFormData(prev => {
      const exists = prev.modulesAllowed.includes(modId);
      if (exists) {
        return { ...prev, modulesAllowed: prev.modulesAllowed.filter(m => m !== modId) };
      } else {
        return { ...prev, modulesAllowed: [...prev.modulesAllowed, modId] };
      }
    });
  };

  // Metrics
  const stats = useMemo(() => {
    const total = companies.length;
    const ativas = companies.filter(c => c.status === 'ativa').length;
    const suspensas = companies.filter(c => c.status === 'suspensa').length;
    const pendentes = companies.filter(c => c.status === 'pendente' || c.status === 'inativa').length;
    return { total, ativas, suspensas, pendentes };
  }, [companies]);

  // Filtered List
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        c.tradeName.toLowerCase().includes(term) ||
        c.corporateName.toLowerCase().includes(term) ||
        c.cnpj.includes(term) ||
        c.code.toLowerCase().includes(term) ||
        c.adminEmail.toLowerCase().includes(term) ||
        c.contactName.toLowerCase().includes(term)
      );
    });
  }, [companies, statusFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                Empresas Parceiras & Matrizes
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
                  Multiempresa
                </span>
              </h2>
              <p className="text-sm text-slate-400">
                Gestão centralizada de parceiros comerciais, filiais associadas, limites e controle de acesso
              </p>
            </div>
          </div>
        </div>

        {isMasterOwner && (
          <button
            onClick={openNewCompanyModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Empresa Parceira
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex items-center gap-2 animate-fade-in text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Total de Empresas</span>
            <Building2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-1">Registradas na plataforma</div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Empresas Ativas</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{stats.ativas}</div>
          <div className="text-[11px] text-slate-500 mt-1">Operando regularmente</div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Empresas Suspensas</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{stats.suspensas}</div>
          <div className="text-[11px] text-slate-500 mt-1">Acesso temporariamente retido</div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Filiais Integradas</span>
            <GitBranch className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400">{branches.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Distribuídas em rede</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por razão social, nome fantasia, CNPJ, código ou responsável..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativa">Ativas</option>
            <option value="suspensa">Suspensas</option>
            <option value="pendente">Pendentes</option>
            <option value="inativa">Inativas</option>
          </select>
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredCompanies.map(company => {
          const compBranches = branches.filter(b => b.companyId === company.id);
          const compCustomers = customers.filter(c => c.companyId === company.id);
          const isSelected = activeCompanyId === company.id;

          return (
            <div
              key={company.id}
              className={`flex flex-col justify-between rounded-2xl bg-slate-900/70 border transition-all duration-200 p-5 ${
                isSelected
                  ? 'border-cyan-500/70 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/50'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-lg">
                      {company.tradeName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                          {company.code}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            company.status === 'ativa'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                              : company.status === 'suspensa'
                              ? 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {company.status === 'ativa' ? 'Ativa' : company.status === 'suspensa' ? 'Suspensa' : company.status}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1 line-clamp-1">{company.tradeName}</h3>
                      <p className="text-xs text-slate-400 line-clamp-1">{company.corporateName}</p>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">CNPJ:</span>
                    <span className="font-mono text-slate-200">{company.cnpj || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Plano Contratado:</span>
                    <span className="font-semibold text-cyan-300">{company.planContracted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Responsável:</span>
                    <span className="text-slate-200">{company.contactName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">E-mail Comercial:</span>
                    <span className="text-slate-200 truncate max-w-[180px]">{company.email}</span>
                  </div>
                  {company.city && company.state && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Localização:</span>
                      <span className="text-slate-200">{company.city}/{company.state}</span>
                    </div>
                  )}
                </div>

                {/* Quotas / Usage */}
                <div className="grid grid-cols-2 gap-3 py-3">
                  <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Filiais</span>
                      <span className="font-bold text-white">
                        {compBranches.length} / {company.branchesLimit}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-purple-500 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (compBranches.length / (company.branchesLimit || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Clientes</span>
                      <span className="font-bold text-white">
                        {compCustomers.length} / {company.clientsLimit}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-cyan-400 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (compCustomers.length / (company.clientsLimit || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Modules Allowed Pills */}
                <div className="pt-2">
                  <span className="text-[11px] text-slate-500 font-medium">Módulos Liberados:</span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(company.modulesAllowed || []).slice(0, 4).map(mod => (
                      <span
                        key={mod}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60"
                      >
                        {mod}
                      </span>
                    ))}
                    {(company.modulesAllowed || []).length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400">
                        +{(company.modulesAllowed || []).length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 mt-3 border-t border-slate-800/80 flex flex-col gap-2">
                {isMasterOwner && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setActiveCompanyId(isSelected ? 'TODAS' : company.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                          : 'bg-cyan-950/40 text-cyan-300 border border-cyan-800/50 hover:bg-cyan-900/50'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      {isSelected ? 'Contexto Ativo' : 'Ver Dados'}
                    </button>

                    {onNavigateToBranches && (
                      <button
                        onClick={() => onNavigateToBranches(company.id)}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                        Ver Filiais ({compBranches.length})
                      </button>
                    )}
                  </div>
                )}

                {isMasterOwner && (
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => openEditModal(company)}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 py-1 px-2 rounded hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Editar Parâmetros
                    </button>

                    <button
                      onClick={() => handleToggleStatus(company)}
                      className={`text-xs flex items-center gap-1 py-1 px-2 rounded transition-colors cursor-pointer ${
                        company.status === 'suspensa'
                          ? 'text-emerald-400 hover:bg-emerald-950/40'
                          : 'text-amber-400 hover:bg-amber-950/40'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {company.status === 'suspensa' ? 'Reativar Empresa' : 'Suspender Acesso'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCompanies.length === 0 && (
        <div className="p-12 text-center bg-slate-900/30 rounded-2xl border border-slate-800">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">Nenhuma empresa parceira encontrada</h3>
          <p className="text-sm text-slate-500 mt-1">Ajuste os filtros de pesquisa ou cadastre uma nova empresa parceira.</p>
        </div>
      )}

      {/* Modal Criar / Editar Empresa */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingCompany ? 'Editar Empresa Parceira' : 'Cadastrar Empresa Parceira'}
                  </h3>
                  <p className="text-xs text-slate-400">Configuração de parâmetros, limites e credenciais empresariais</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Basic Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> 1. Dados Cadastrais & Fiscais
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Código Identificador</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white font-mono"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">Nome Fantasia *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Prime Telecom Solutions"
                      value={formData.tradeName}
                      onChange={e => setFormData({ ...formData, tradeName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Razão Social</label>
                    <input
                      type="text"
                      placeholder="Ex: Prime Telecomunicações Ltda"
                      value={formData.corporateName}
                      onChange={e => setFormData({ ...formData, corporateName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">CNPJ</label>
                    <input
                      type="text"
                      placeholder="00.000.000/0001-00"
                      value={formData.cnpj}
                      onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Responsible & Contact */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Users className="w-4 h-4" /> 2. Responsável & Acesso Administrativo
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Nome do Responsável *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos Eduardo Silveira"
                      value={formData.contactName}
                      onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Cargo / Função</label>
                    <input
                      type="text"
                      placeholder="Ex: Diretor Geral / Sócio"
                      value={formData.contactRole}
                      onChange={e => setFormData({ ...formData, contactRole: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">E-mail Comercial / Login Admin *</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@parceiro.com.br"
                      value={formData.adminEmail}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          adminEmail: e.target.value,
                          email: formData.email || e.target.value,
                          adminName: formData.adminName || formData.contactName,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Telefone / WhatsApp Comercial</label>
                    <input
                      type="text"
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Plan, Quotas & Limits */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> 3. Plano Contratado & Limites de Utilização
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Plano da Empresa</label>
                    <select
                      value={formData.planContracted}
                      onChange={e => setFormData({ ...formData, planContracted: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    >
                      <option value="Empresarial Start">Empresarial Start (Até 2 Filiais / 200 Clientes)</option>
                      <option value="Empresarial Pro">Empresarial Pro (Até 5 Filiais / 500 Clientes)</option>
                      <option value="Empresarial Platinum">Empresarial Platinum (Até 10 Filiais / 1.500 Clientes)</option>
                      <option value="Enterprise Unlimited">Enterprise Unlimited (Personalizado)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Limite Máximo de Filiais</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.branchesLimit}
                      onChange={e => setFormData({ ...formData, branchesLimit: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Limite Máximo de Clientes</label>
                    <input
                      type="number"
                      min="50"
                      max="50000"
                      value={formData.clientsLimit}
                      onChange={e => setFormData({ ...formData, clientsLimit: parseInt(e.target.value) || 100 })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Modules allowed */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> 4. Módulos & Recursos Permitidos
                </h4>
                <p className="text-xs text-slate-400">
                  Defina quais recursos a equipe desta empresa parceira poderá acessar no painel:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AVAILABLE_MODULES.map(m => {
                    const checked = formData.modulesAllowed.includes(m.id);
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => toggleModule(m.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                          checked
                            ? 'bg-cyan-950/50 border-cyan-500/60 text-cyan-300 font-semibold'
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span>{m.label}</span>
                        {checked ? (
                          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <div className="w-4 h-4 rounded border border-slate-700" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Address */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> 5. Endereço Sede
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">CEP</label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      value={formData.cep}
                      onChange={e => setFormData({ ...formData, cep: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">Logradouro / Rua</label>
                    <input
                      type="text"
                      placeholder="Av. Paulista"
                      value={formData.street}
                      onChange={e => setFormData({ ...formData, street: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Número</label>
                    <input
                      type="text"
                      value={formData.number}
                      onChange={e => setFormData({ ...formData, number: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Bairro</label>
                    <input
                      type="text"
                      value={formData.neighborhood}
                      onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={formData.state}
                      onChange={e => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Status & Notes */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Status Operacional</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as CompanyStatus })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    >
                      <option value="ativa">Ativa (Acesso Liberado)</option>
                      <option value="pendente">Pendente (Em Validação Cadastral)</option>
                      <option value="suspensa">Suspensa (Acesso Bloqueado)</option>
                      <option value="inativa">Inativa (Encerrada)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Observações Internas (Master)</label>
                    <input
                      type="text"
                      placeholder="Anotações confidenciais..."
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Gravando...' : editingCompany ? 'Salvar Alterações' : 'Cadastrar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspension Confirmation Modal */}
      {suspensionModalCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-white">Suspender Empresa Parceira</h3>
            </div>
            <p className="text-sm text-slate-300">
              Você está suspendendo o acesso da empresa <strong className="text-white">{suspensionModalCompany.tradeName}</strong> e de todas as suas filiais vinculadas.
            </p>
            <p className="text-xs text-slate-400">
              Os dados históricos, clientes e contratos continuarão preservados no sistema para conformidade e auditoria.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Motivo da Suspensão:</label>
              <input
                type="text"
                value={suspensionReason}
                onChange={e => setSuspensionReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white"
                placeholder="Ex: Atraso de pagamento ou descumprimento contratual"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSuspensionModalCompany(null)}
                className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSuspension}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all cursor-pointer"
              >
                Confirmar Suspensão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
