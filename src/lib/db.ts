/**
 * Firestore Database Service and Local Persistent Fallback
 * Implements strict CRUD, multi-company/branch isolation, audit logging, recurrence engine, and seed configuration
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase.ts';
import {
  Customer,
  Plan,
  Subscription,
  Contract,
  ContractTemplate,
  Invoice,
  Payment,
  Partner,
  Commission,
  EmployeeProfile,
  AuditLog,
  CompanySettings,
  WhatsAppApiSettings,
  MasterOwnerCredentials,
  MessageLog,
  PartnerCompany,
  Branch,
  CompanyStatus,
  BranchStatus,
} from '../types/index.ts';
import { calculateNextDueDate, getDaysDiff, getReferencePeriod, getTodaySaoPaulo } from './date.ts';

// Default initial Master Owner credentials state
export const DEFAULT_MASTER_EMAIL = 'Alifermadeiro@hotmail.com';
export const ALT_MASTER_EMAIL = 'alifer.qualicare@gmail.com';
export const MASTER_EMAILS = [
  'alifermadeiro@hotmail.com',
  'alifer.qualicare@gmail.com',
  'alifergael76@gmail.com',
];

// Default Matriz Company (Primary Enterprise)
export const DEFAULT_MATRIZ_COMPANY: PartnerCompany = {
  id: 'company-matriz-01',
  code: 'EMP-001',
  corporateName: 'ONNIX PLAY COMUNICACAO & TECNOLOGIA LTDA',
  tradeName: 'ONNIX PLAY MATRIZ',
  cnpj: '48.912.430/0001-85',
  contactName: 'Alifer Madeira (Master Owner)',
  contactRole: 'Diretor Presidente',
  email: 'Alifermadeiro@hotmail.com',
  phone: '+55 (11) 3280-4590',
  cep: '01310-100',
  street: 'Av. Paulista',
  number: '1000',
  complement: 'Andar 14, Conjunto 142',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  status: 'ativa',
  planContracted: 'Enterprise Global Unlimited',
  branchesLimit: 999,
  clientsLimit: 99999,
  modulesAllowed: ['empresas', 'filiais', 'clientes', 'contratos', 'mensalistas', 'planos', 'cobrancas', 'pagamentos', 'vencimentos', 'whatsapp', 'parceiros', 'comissoes', 'usuarios', 'relatorios', 'auditoria'],
  adminEmail: 'Alifermadeiro@hotmail.com',
  adminName: 'Master Owner',
  notes: 'Sede central e matriz controladora da rede ONNIX PLAY.',
  createdAt: '2026-01-01',
};

// Initial Seed Companies
export const INITIAL_COMPANIES: PartnerCompany[] = [
  DEFAULT_MATRIZ_COMPANY,
  {
    id: 'company-parceira-02',
    code: 'EMP-002',
    corporateName: 'TECHPLAY ENTRETENIMENTO & CONECTIVIDADE LTDA',
    tradeName: 'TECHPLAY BRASIL (PARCEIRA)',
    cnpj: '33.821.902/0001-44',
    contactName: 'Marcelo Augusto Valença',
    contactRole: 'Sócio-Diretor',
    email: 'marcelo@techplaybrasil.com.br',
    phone: '+55 (21) 3900-8800',
    cep: '20040-002',
    street: 'Av. Rio Branco',
    number: '156',
    complement: 'Sala 801',
    neighborhood: 'Centro',
    city: 'Rio de Janeiro',
    state: 'RJ',
    status: 'ativa',
    planContracted: 'Empresarial Premium (Até 10 Filiais)',
    branchesLimit: 10,
    clientsLimit: 2500,
    modulesAllowed: ['filiais', 'clientes', 'contratos', 'cobrancas', 'relatorios'],
    adminEmail: 'admin@techplaybrasil.com.br',
    adminName: 'Administrador TechPlay',
    notes: 'Empresa parceira autorizada para operação no estado do Rio de Janeiro e Minas Gerais.',
    createdAt: '2026-01-10',
  },
  {
    id: 'company-parceira-03',
    code: 'EMP-003',
    corporateName: 'SULSTREAM DISTRIBUIDORA DE SERVICOS LTDA',
    tradeName: 'SULSTREAM SUL',
    cnpj: '19.402.118/0001-92',
    contactName: 'Claudia Bittencourt',
    contactRole: 'Diretora Regional',
    email: 'claudia@sulstream.com.br',
    phone: '+55 (41) 3044-7700',
    cep: '80020-010',
    street: 'Rua XV de Novembro',
    number: '400',
    neighborhood: 'Centro',
    city: 'Curitiba',
    state: 'PR',
    status: 'ativa',
    planContracted: 'Empresarial Pro (Até 5 Filiais)',
    branchesLimit: 5,
    clientsLimit: 1000,
    modulesAllowed: ['filiais', 'clientes', 'contratos', 'cobrancas', 'relatorios'],
    adminEmail: 'admin@sulstream.com.br',
    adminName: 'Administrador SulStream',
    notes: 'Atuação na região Sul com foco em assinaturas empresariais.',
    createdAt: '2026-02-01',
  },
];

// Initial Seed Branches
export const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'branch-matriz-01',
    code: 'FIL-001',
    companyId: 'company-matriz-01',
    name: 'Unidade Central Jardins (SP)',
    cnpj: '48.912.430/0001-85',
    managerName: 'Roberto Silva',
    managerEmail: 'roberto.silva@onnixplay.com.br',
    phone: '+55 (11) 98888-1122',
    email: 'jardins@onnixplay.com.br',
    cep: '01414-001',
    street: 'Alameda Santos',
    number: '1293',
    neighborhood: 'Cerqueira César',
    city: 'São Paulo',
    state: 'SP',
    status: 'ativa',
    notes: 'Unidade polo e atendimento regional capital.',
    createdAt: '2026-01-01',
  },
  {
    id: 'branch-campinas-02',
    code: 'FIL-002',
    companyId: 'company-matriz-01',
    name: 'Filial Campinas & Região',
    cnpj: '48.912.430/0002-66',
    managerName: 'Fernanda Lima',
    managerEmail: 'fernanda.lima@onnixplay.com.br',
    phone: '+55 (19) 97777-2233',
    email: 'campinas@onnixplay.com.br',
    cep: '13010-111',
    street: 'Av. Francisco Glicério',
    number: '850',
    neighborhood: 'Centro',
    city: 'Campinas',
    state: 'SP',
    status: 'ativa',
    notes: 'Atendimento do interior e polo tecnológico.',
    createdAt: '2026-01-15',
  },
  {
    id: 'branch-techplay-rj',
    code: 'FIL-003',
    companyId: 'company-parceira-02',
    name: 'Unidade Barra da Tijuca',
    cnpj: '33.821.902/0002-25',
    managerName: 'Gabriel Nogueira',
    managerEmail: 'gabriel@techplaybrasil.com.br',
    phone: '+55 (21) 98111-4455',
    email: 'barra@techplaybrasil.com.br',
    cep: '22640-100',
    street: 'Av. das Américas',
    number: '3500',
    complement: 'Bloco 4, Loja 110',
    neighborhood: 'Barra da Tijuca',
    city: 'Rio de Janeiro',
    state: 'RJ',
    status: 'ativa',
    notes: 'Unidade comercial da parceira TechPlay.',
    createdAt: '2026-01-20',
  },
  {
    id: 'branch-sulstream-cwb',
    code: 'FIL-004',
    companyId: 'company-parceira-03',
    name: 'Unidade Batel Curitiba',
    cnpj: '19.402.118/0002-73',
    managerName: 'Rodrigo Antunes',
    managerEmail: 'rodrigo@sulstream.com.br',
    phone: '+55 (41) 99222-3344',
    email: 'batel@sulstream.com.br',
    cep: '80420-000',
    street: 'Av. do Batel',
    number: '1230',
    neighborhood: 'Batel',
    city: 'Curitiba',
    state: 'PR',
    status: 'ativa',
    notes: 'Filial regional da parceira SulStream.',
    createdAt: '2026-02-05',
  },
];

// Default Company Settings
export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'ONNIX PLAY',
  tradeName: 'ONNIX PLAY ENTRETENIMENTO & CONECTIVIDADE',
  cnpj: '48.912.430/0001-85',
  phone: '+55 (11) 3280-4590',
  whatsapp: '+55 (11) 98765-4321',
  email: 'contato@onnixplay.com.br',
  address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100',
  pixKey: '48.912.430/0001-85',
  pixKeyType: 'CNPJ',
  defaultPaymentTerms: 'Vencimento todo dia 10. Pagamento via PIX com baixa automática ou comprovante no WhatsApp.',
  reminderDaysBefore: 2,
};

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppApiSettings = {
  enabled: false,
  phoneNumberId: '',
  businessAccountId: '',
  permanentAccessToken: '',
  webhookVerifyToken: '',
  templateNamespace: '',
};

export const DEFAULT_CONTRACT_TEMPLATE: ContractTemplate = {
  id: 'template-padrao-01',
  name: 'Contrato Padrão de Assinatura Empresarial ONNIX PLAY',
  description: 'Modelo oficial para contratações empresariais e multiempresa',
  isDefault: true,
  createdAt: '2026-01-01',
  defaultClauses: `CLÁUSULA 1ª - DO OBJETO: O presente contrato tem por objeto a prestação de serviços de assinatura do plano {{nome_plano}} pela CONTRATADA ao CONTRATANTE, por meio da unidade/filial {{nome_filial}}.
CLÁUSULA 2ª - DO VALOR E PAGAMENTO: O CONTRATANTE pagará à CONTRATADA o valor contratado de {{valor_contratado}} com periodicidade {{periodicidade}}, sendo o primeiro vencimento em {{data_vencimento}}.
CLÁUSULA 3ª - DA VIGÊNCIA E RENOVAÇÃO: O presente contrato tem início em {{data_inicio}} e término previsto em {{data_final}}, renovando-se automaticamente sob as mesmas condições, salvo manifestação em contrário com 15 dias de antecedência.
CLÁUSULA 4ª - DA RESCISÃO E CANCELAMENTO: O cancelamento poderá ser solicitado a qualquer momento pelo CONTRATANTE, respeitadas eventuais faturas emitidas e proporcionais devidos.
CLÁUSULA 5ª - DO TRATAMENTO DE DADOS (LGPD): As partes declaram ciência e conformidade com as diretrizes da Lei nº 13.709/2018 (LGPD), destinando os dados exclusivamente à execução contratual.`,
  templateContent: `INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS E ASSINATURA EMPRESARIAL

CONTRATADA: {{empresa_nome}}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {{empresa_cnpj}}, com sede em {{empresa_endereco}}.
UNIDADE / FILIAL RESPONSÁVEL: {{nome_filial}}.

CONTRATANTE: {{nome_cliente}}, inscrito(a) no CPF/CNPJ sob o nº {{cpf_cliente}}, residente e domiciliado(a) em {{endereco_cliente}}.

As partes acima qualificadas têm, entre si, justo e acordado o presente Contrato de Prestação de Serviços, regido pelas cláusulas seguintes:

1. DO PLANO E DA CONTRATAÇÃO
1.1. O CONTRATANTE opta pela adesão ao plano denominado {{nome_plano}}.
1.2. O valor acertado para a contratação é de {{valor_contratado}}, com periodicidade de faturamento {{periodicidade}}.

2. DOS VENCIMENTOS E PAGAMENTOS
2.1. O primeiro vencimento está estipulado para a data de {{data_vencimento}}.
2.2. A data de início efetivo dos serviços é {{data_inicio}}, com vigência estipulada até {{data_final}}.

3. DAS OBRIGAÇÕES DAS PARTES
3.1. A CONTRATADA compromete-se a manter a disponibilidade e a qualidade técnica compatível com o plano contratado.
3.2. O CONTRATANTE compromete-se a efetuar os pagamentos pontualmente pelas vias autorizadas (PIX, boleto bancário ou cartão).

4. DO CANCELAMENTO E DISPOSIÇÕES GERAIS
4.1. Em caso de inadimplência superior a 5 (cinco) dias, a prestação dos serviços poderá ser suspensa temporariamente até a devida regularização.
4.2. As partes elegem o foro da Comarca de São Paulo/SP para dirimir eventuais litígios oriundos do presente instrumento.

Local e data: São Paulo, {{data_atual}}.`,
};

// Seed baseline plans
export const INITIAL_PLANS: Plan[] = [
  {
    id: 'plan-basic',
    name: 'ONNIX Silver',
    description: 'Acesso completo com suporte padrão e 2 telas simultâneas',
    price: 39.9,
    billingCycle: 'mensal',
    durationMonths: 12,
    renewalRules: 'Renovação automática mensal',
    terms: 'Suporte em horário comercial. Cancelamento sem multa.',
    additionalFees: 0,
    allowedDiscounts: 5.0,
    status: 'ativo',
    createdAt: '2026-01-01',
  },
  {
    id: 'plan-gold',
    name: 'ONNIX Gold (Trimestral)',
    description: 'Plano trimestral promocional com 4 telas e suporte prioritário',
    price: 99.9,
    billingCycle: 'trimestral',
    durationMonths: 12,
    renewalRules: 'Renovação automática a cada 3 meses',
    terms: 'Ciclo trimestral. Desconto progressivo garantido.',
    additionalFees: 0,
    allowedDiscounts: 10.0,
    status: 'ativo',
    createdAt: '2026-01-01',
  },
  {
    id: 'plan-black',
    name: 'ONNIX Black Anual',
    description: 'Plano anual premium com acesso ilimitado e gerente dedicado',
    price: 359.0,
    billingCycle: 'anual',
    durationMonths: 12,
    renewalRules: 'Renovação anual com aviso prévio de 30 dias',
    terms: 'Fidelidade de 12 meses. Parcelamento em até 12x.',
    additionalFees: 0,
    allowedDiscounts: 20.0,
    status: 'ativo',
    createdAt: '2026-01-01',
  },
  {
    id: 'plan-enterprise-pro',
    name: 'ONNIX Enterprise Pro Multiempresa',
    description: 'Solução corporativa multi-telas para filiais e empresas parceiras',
    price: 599.0,
    billingCycle: 'mensal',
    durationMonths: 12,
    renewalRules: 'Renovação automática com gerente de conta B2B',
    terms: 'Contrato corporativo com SLA garantido de 99.9%.',
    additionalFees: 0,
    allowedDiscounts: 50.0,
    status: 'ativo',
    createdAt: '2026-01-01',
  },
];

// Helper to interact with LocalStorage as immediate persistent cache & offline guarantee
function getLocalCache<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(`onnix_${key}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn(`Error reading local storage for ${key}:`, e);
  }
  return defaultValue;
}

function setLocalCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`onnix_${key}`, JSON.stringify(value));
  } catch (e) {
    console.warn(`Error writing local storage for ${key}:`, e);
  }
}

// Service class for data operations
export class DatabaseService {
  // Settings
  static async getSettings(): Promise<CompanySettings> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'general'));
      if (snap.exists()) {
        const data = snap.data() as CompanySettings;
        setLocalCache('settings_general', data);
        return data;
      }
    } catch (e) {
      console.warn('Fallback to local settings:', e);
    }
    return getLocalCache('settings_general', DEFAULT_COMPANY_SETTINGS);
  }

  static async saveSettings(settings: CompanySettings, userEmail: string): Promise<void> {
    setLocalCache('settings_general', settings);
    try {
      await setDoc(doc(db, 'settings', 'general'), settings);
    } catch (e) {
      console.warn('Could not save to remote settings:', e);
    }
    await this.logAudit(userEmail, 'CONFIGURACAO_ATUALIZADA', 'settings', 'general', 'Dados da empresa atualizados');
  }

  // Master Owner Security Credentials
  static async getMasterOwnerCredentials(): Promise<MasterOwnerCredentials | null> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'master_owner_creds'));
      if (snap.exists()) {
        const creds = snap.data() as MasterOwnerCredentials;
        setLocalCache('master_owner_creds', creds);
        return creds;
      }
    } catch (e) {
      console.warn('Fallback to cached master creds:', e);
    }
    return getLocalCache<MasterOwnerCredentials | null>('master_owner_creds', null);
  }

  static async saveMasterOwnerCredentials(creds: MasterOwnerCredentials): Promise<void> {
    setLocalCache('master_owner_creds', creds);
    try {
      await setDoc(doc(db, 'settings', 'master_owner_creds'), creds);
    } catch (e) {
      console.warn('Could not write master creds to Firestore:', e);
    }
    await this.logAudit(creds.email, 'MASTER_OWNER_CONFIGURADO', 'master_owner', creds.email, 'Credenciais e senha forte salvas');
  }

  // Audit Logs
  static async logAudit(
    userEmail: string,
    action: string,
    entityType: string,
    entityId: string,
    details: string,
    companyId?: string,
    branchId?: string
  ): Promise<void> {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userEmail,
      companyId: companyId || undefined,
      branchId: branchId || undefined,
      action,
      entityType,
      entityId,
      details,
      timestamp: new Date().toISOString(),
    };

    const cached = getLocalCache<AuditLog[]>('audit_logs', []);
    setLocalCache('audit_logs', [log, ...cached]);

    try {
      await setDoc(doc(db, 'audit_logs', log.id), log);
    } catch (e) {
      console.warn('Audit log write error (saved locally):', e);
    }
  }

  static async getAuditLogs(companyId?: string): Promise<AuditLog[]> {
    try {
      const snap = await getDocs(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(150)));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as AuditLog);
        setLocalCache('audit_logs', list);
        if (companyId && companyId !== 'TODAS') {
          return list.filter(l => !l.companyId || l.companyId === companyId);
        }
        return list;
      }
    } catch (e) {
      console.warn('Fallback to cached audit logs:', e);
    }
    const cached = getLocalCache<AuditLog[]>('audit_logs', []);
    if (companyId && companyId !== 'TODAS') {
      return cached.filter(l => !l.companyId || l.companyId === companyId);
    }
    return cached;
  }

  // ==========================================
  // PARTNER COMPANIES (EMPRESAS PARCEIRAS)
  // ==========================================
  static async getCompanies(): Promise<PartnerCompany[]> {
    try {
      const snap = await getDocs(collection(db, 'companies'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as PartnerCompany);
        setLocalCache('companies', list);
        return list;
      }
    } catch (e) {
      console.warn('Reading local companies cache:', e);
    }
    const cached = getLocalCache<PartnerCompany[]>('companies', INITIAL_COMPANIES);
    return cached.length ? cached : INITIAL_COMPANIES;
  }

  static async saveCompany(company: PartnerCompany, userEmail: string): Promise<void> {
    const isNew = !company.createdAt;
    const now = new Date().toISOString();
    const toSave: PartnerCompany = {
      ...company,
      createdAt: company.createdAt || now,
      updatedAt: now,
    };

    const current = await this.getCompanies();
    const filtered = current.filter(c => c.id !== toSave.id);
    const updatedList = [toSave, ...filtered];
    setLocalCache('companies', updatedList);

    try {
      await setDoc(doc(db, 'companies', toSave.id), toSave);
    } catch (e) {
      console.warn('Saved company locally:', e);
    }

    await this.logAudit(
      userEmail,
      isNew ? 'EMPRESA_CRIADA' : 'EMPRESA_ATUALIZADA',
      'companies',
      toSave.id,
      `Empresa Parceira ${toSave.tradeName} (${toSave.code}) - Status: ${toSave.status}`,
      toSave.id
    );
  }

  static async updateCompanyStatus(companyId: string, status: CompanyStatus, userEmail: string): Promise<void> {
    const companies = await this.getCompanies();
    const company = companies.find(c => c.id === companyId);
    if (!company) return;

    company.status = status;
    company.updatedAt = new Date().toISOString();
    await this.saveCompany(company, userEmail);

    await this.logAudit(
      userEmail,
      'STATUS_EMPRESA_ALTERADO',
      'companies',
      companyId,
      `Status da empresa ${company.tradeName} alterado para ${status}`,
      companyId
    );
  }

  static async createCompany(
    companyData: Omit<PartnerCompany, 'id' | 'createdAt'>,
    userEmail: string
  ): Promise<PartnerCompany> {
    const id = `company-${Date.now()}`;
    const newCompany: PartnerCompany = {
      ...companyData,
      id,
      createdAt: new Date().toISOString(),
    };
    await this.saveCompany(newCompany, userEmail);
    return newCompany;
  }

  static async updateCompany(
    companyId: string,
    updates: Partial<PartnerCompany>,
    userEmail: string
  ): Promise<void> {
    const companies = await this.getCompanies();
    const existing = companies.find(c => c.id === companyId);
    if (!existing) throw new Error('Empresa parceira não encontrada.');
    const updated: PartnerCompany = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.saveCompany(updated, userEmail);
  }

  static async deleteCompany(companyId: string, userEmail: string): Promise<void> {
    if (companyId === 'company-matriz-01') {
      throw new Error('A empresa Matriz ONNIX PLAY é protegida e não pode ser excluída.');
    }
    const current = await this.getCompanies();
    setLocalCache('companies', current.filter(c => c.id !== companyId));
    try {
      await deleteDoc(doc(db, 'companies', companyId));
    } catch (e) {
      console.warn('Delete company remote error:', e);
    }
    await this.logAudit(userEmail, 'EMPRESA_EXCLUIDA', 'companies', companyId, 'Empresa parceira removida');
  }

  // ==========================================
  // BRANCHES (FILIAIS)
  // ==========================================
  static async getBranches(companyId?: string): Promise<Branch[]> {
    try {
      const snap = await getDocs(collection(db, 'branches'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as Branch);
        setLocalCache('branches', list);
        if (companyId && companyId !== 'TODAS') {
          return list.filter(b => b.companyId === companyId);
        }
        return list;
      }
    } catch (e) {
      console.warn('Reading local branches:', e);
    }
    const cached = getLocalCache<Branch[]>('branches', INITIAL_BRANCHES);
    const list = cached.length ? cached : INITIAL_BRANCHES;
    if (companyId && companyId !== 'TODAS') {
      return list.filter(b => b.companyId === companyId);
    }
    return list;
  }

  static async saveBranch(branch: Branch, userEmail: string): Promise<void> {
    const isNew = !branch.createdAt;
    const now = new Date().toISOString();
    const toSave: Branch = {
      ...branch,
      createdAt: branch.createdAt || now,
      updatedAt: now,
    };

    const current = await this.getBranches();
    const filtered = current.filter(b => b.id !== toSave.id);
    const updated = [toSave, ...filtered];
    setLocalCache('branches', updated);

    try {
      await setDoc(doc(db, 'branches', toSave.id), toSave);
    } catch (e) {
      console.warn('Branch saved locally:', e);
    }

    await this.logAudit(
      userEmail,
      isNew ? 'FILIAL_CRIADA' : 'FILIAL_ATUALIZADA',
      'branches',
      toSave.id,
      `Filial ${toSave.name} (${toSave.code}) vinculada à empresa ${toSave.companyId}`,
      toSave.companyId,
      toSave.id
    );
  }

  static async createBranch(
    branchData: Omit<Branch, 'id' | 'createdAt'>,
    userEmail: string
  ): Promise<Branch> {
    const id = `branch-${Date.now()}`;
    const newBranch: Branch = {
      ...branchData,
      id,
      createdAt: new Date().toISOString(),
    };
    await this.saveBranch(newBranch, userEmail);
    return newBranch;
  }

  static async updateBranch(
    branchId: string,
    updates: Partial<Branch>,
    userEmail: string
  ): Promise<void> {
    const branches = await this.getBranches();
    const existing = branches.find(b => b.id === branchId);
    if (!existing) throw new Error('Filial não encontrada.');
    const updated: Branch = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.saveBranch(updated, userEmail);
  }

  static async deleteBranch(branchId: string, userEmail: string): Promise<void> {
    const current = await this.getBranches();
    const branch = current.find(b => b.id === branchId);
    setLocalCache('branches', current.filter(b => b.id !== branchId));
    try {
      await deleteDoc(doc(db, 'branches', branchId));
    } catch (e) {
      console.warn('Delete branch remote error:', e);
    }
    await this.logAudit(
      userEmail,
      'FILIAL_EXCLUIDA',
      'branches',
      branchId,
      `Filial removida`,
      branch?.companyId
    );
  }

  // Transfer client between branches with audit log
  static async transferCustomerBranch(
    customerId: string,
    targetBranchId: string,
    targetCompanyId: string,
    reason?: string,
    userEmail: string = 'master@onnix.com'
  ): Promise<void> {
    const customers = await this.getCustomers();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) throw new Error('Cliente não encontrado.');

    const oldCompany = customer.companyId;
    const oldBranch = customer.branchId;

    customer.companyId = targetCompanyId;
    customer.branchId = targetBranchId;
    customer.updatedAt = new Date().toISOString();

    await this.saveCustomer(customer, userEmail);

    await this.logAudit(
      userEmail,
      'TRANSFERENCIA_CLIENTE_FILIAL',
      'customers',
      customer.id,
      `Cliente ${customer.name} transferido da empresa/filial [${oldCompany}/${oldBranch}] para [${targetCompanyId}/${targetBranchId}]. Motivo: ${reason || 'Remanejamento autorizado'}`,
      targetCompanyId,
      targetBranchId
    );
  }

  // Transfer contract between branches with audit log
  static async transferContractBranch(
    contractId: string,
    targetBranchId: string,
    targetCompanyId: string,
    reason?: string,
    userEmail: string = 'master@onnix.com'
  ): Promise<void> {
    const contracts = await this.getContracts();
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) throw new Error('Contrato não encontrado.');

    const oldCompany = contract.companyId;
    const oldBranch = contract.branchId;

    contract.companyId = targetCompanyId;
    contract.branchId = targetBranchId;
    contract.updatedAt = new Date().toISOString();

    await this.saveContract(contract, userEmail);

    await this.logAudit(
      userEmail,
      'TRANSFERENCIA_CONTRATO_FILIAL',
      'contracts',
      contract.id,
      `Contrato ${contract.documentNumber} transferido da unidade [${oldCompany}/${oldBranch}] para [${targetCompanyId}/${targetBranchId}]. Motivo: ${reason || 'Ajuste de jurisdição comercial'}`,
      targetCompanyId,
      targetBranchId
    );
  }

  // ==========================================
  // CUSTOMERS (MULTIEMPRESA)
  // ==========================================
  static async getCustomers(companyId?: string, branchId?: string): Promise<Customer[]> {
    let list: Customer[] = [];
    try {
      const snap = await getDocs(collection(db, 'customers'));
      if (!snap.empty) {
        list = snap.docs.map(d => d.data() as Customer);
        setLocalCache('customers', list);
      } else {
        list = getLocalCache<Customer[]>('customers', []);
      }
    } catch (e) {
      console.warn('Reading local customers cache:', e);
      list = getLocalCache<Customer[]>('customers', []);
    }

    // Ensure backwards compatibility: every customer has companyId and branchId
    list = list.map(c => ({
      ...c,
      companyId: c.companyId || 'company-matriz-01',
      branchId: c.branchId || 'branch-matriz-01',
    }));

    if (companyId && companyId !== 'TODAS') {
      list = list.filter(c => c.companyId === companyId);
    }
    if (branchId && branchId !== 'TODAS') {
      list = list.filter(c => c.branchId === branchId);
    }

    return list;
  }

  static async saveCustomer(customer: Customer, userEmail: string): Promise<void> {
    const isNew = !customer.createdAt;
    const now = new Date().toISOString();
    const toSave: Customer = {
      ...customer,
      companyId: customer.companyId || 'company-matriz-01',
      branchId: customer.branchId || 'branch-matriz-01',
      createdAt: customer.createdAt || now,
      updatedAt: now,
    };

    const current = getLocalCache<Customer[]>('customers', []);
    const filtered = current.filter(c => c.id !== toSave.id);
    setLocalCache('customers', [toSave, ...filtered]);

    try {
      await setDoc(doc(db, 'customers', toSave.id), toSave);
    } catch (e) {
      console.warn('Saved customer locally:', e);
    }

    await this.logAudit(
      userEmail,
      isNew ? 'CLIENTE_CRIADO' : 'CLIENTE_ATUALIZADO',
      'customers',
      toSave.id,
      `Cliente ${toSave.name} (${toSave.code}) - Empresa: ${toSave.companyId}`,
      toSave.companyId,
      toSave.branchId
    );
  }

  static async deleteCustomer(customerId: string, userEmail: string): Promise<void> {
    const current = getLocalCache<Customer[]>('customers', []);
    const target = current.find(c => c.id === customerId);
    setLocalCache('customers', current.filter(c => c.id !== customerId));
    try {
      await deleteDoc(doc(db, 'customers', customerId));
    } catch (e) {
      console.warn('Delete customer remote error:', e);
    }
    await this.logAudit(userEmail, 'CLIENTE_EXCLUIDO', 'customers', customerId, 'Registro de cliente removido', target?.companyId);
  }

  // ==========================================
  // PLANS
  // ==========================================
  static async getPlans(): Promise<Plan[]> {
    try {
      const snap = await getDocs(collection(db, 'plans'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as Plan);
        setLocalCache('plans', list);
        return list;
      }
    } catch (e) {
      console.warn('Reading local plans cache:', e);
    }
    const cached = getLocalCache<Plan[]>('plans', INITIAL_PLANS);
    return cached.length ? cached : INITIAL_PLANS;
  }

  static async savePlan(plan: Plan, userEmail: string): Promise<void> {
    const isNew = !plan.createdAt;
    const toSave: Plan = {
      ...plan,
      createdAt: plan.createdAt || new Date().toISOString(),
    };

    const current = getLocalCache<Plan[]>('plans', INITIAL_PLANS);
    const filtered = current.filter(p => p.id !== toSave.id);
    setLocalCache('plans', [toSave, ...filtered]);

    try {
      await setDoc(doc(db, 'plans', toSave.id), toSave);
    } catch (e) {
      console.warn('Plan saved locally:', e);
    }

    await this.logAudit(
      userEmail,
      isNew ? 'PLANO_CRIADO' : 'PLANO_ATUALIZADO',
      'plans',
      toSave.id,
      `Plano ${toSave.name} (R$ ${toSave.price})`
    );
  }

  // ==========================================
  // SUBSCRIPTIONS
  // ==========================================
  static async getSubscriptions(companyId?: string): Promise<Subscription[]> {
    let list: Subscription[] = [];
    try {
      const snap = await getDocs(collection(db, 'subscriptions'));
      if (!snap.empty) {
        list = snap.docs.map(d => d.data() as Subscription);
        setLocalCache('subscriptions', list);
      } else {
        list = getLocalCache<Subscription[]>('subscriptions', []);
      }
    } catch (e) {
      console.warn('Reading local subscriptions:', e);
      list = getLocalCache<Subscription[]>('subscriptions', []);
    }

    list = list.map(s => ({
      ...s,
      companyId: s.companyId || 'company-matriz-01',
    }));

    if (companyId && companyId !== 'TODAS') {
      list = list.filter(s => s.companyId === companyId);
    }

    return list;
  }

  static async saveSubscription(sub: Subscription, userEmail: string): Promise<void> {
    const toSave: Subscription = {
      ...sub,
      companyId: sub.companyId || 'company-matriz-01',
      createdAt: sub.createdAt || new Date().toISOString(),
    };
    const current = getLocalCache<Subscription[]>('subscriptions', []);
    const filtered = current.filter(s => s.id !== toSave.id);
    setLocalCache('subscriptions', [toSave, ...filtered]);

    try {
      await setDoc(doc(db, 'subscriptions', toSave.id), toSave);
    } catch (e) {
      console.warn('Subscription saved locally:', e);
    }

    await this.logAudit(
      userEmail,
      'ASSINATURA_ATUALIZADA',
      'subscriptions',
      toSave.id,
      `Assinatura cliente ${toSave.customerId} - ciclo ${toSave.billingCycle}`
    );
  }

  // ==========================================
  // CONTRACTS (MULTIEMPRESA)
  // ==========================================
  static async getContracts(companyId?: string, branchId?: string): Promise<Contract[]> {
    let list: Contract[] = [];
    try {
      const snap = await getDocs(collection(db, 'contracts'));
      if (!snap.empty) {
        list = snap.docs.map(d => d.data() as Contract);
        setLocalCache('contracts', list);
      } else {
        list = getLocalCache<Contract[]>('contracts', []);
      }
    } catch (e) {
      console.warn('Reading local contracts:', e);
      list = getLocalCache<Contract[]>('contracts', []);
    }

    list = list.map(c => ({
      ...c,
      companyId: c.companyId || 'company-matriz-01',
      branchId: c.branchId || 'branch-matriz-01',
    }));

    if (companyId && companyId !== 'TODAS') {
      list = list.filter(c => c.companyId === companyId);
    }
    if (branchId && branchId !== 'TODAS') {
      list = list.filter(c => c.branchId === branchId);
    }

    return list;
  }

  static async saveContract(contract: Contract, userEmail: string): Promise<void> {
    const isNew = !contract.createdAt;
    const now = new Date().toISOString();
    const toSave: Contract = {
      ...contract,
      companyId: contract.companyId || 'company-matriz-01',
      branchId: contract.branchId || 'branch-matriz-01',
      createdAt: contract.createdAt || now,
      updatedAt: now,
    };
    const current = getLocalCache<Contract[]>('contracts', []);
    const filtered = current.filter(c => c.id !== toSave.id);
    setLocalCache('contracts', [toSave, ...filtered]);

    try {
      await setDoc(doc(db, 'contracts', toSave.id), toSave);
    } catch (e) {
      console.warn('Contract saved locally:', e);
    }

    await this.logAudit(
      userEmail,
      isNew ? 'CONTRATO_EMITIDO' : 'CONTRATO_ATUALIZADO',
      'contracts',
      toSave.id,
      `Contrato ${toSave.documentNumber} (${toSave.status}) - Empresa: ${toSave.companyId}`,
      toSave.companyId,
      toSave.branchId
    );
  }

  // Contract Templates
  static async getContractTemplates(): Promise<ContractTemplate[]> {
    try {
      const snap = await getDocs(collection(db, 'contract_templates'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as ContractTemplate);
        setLocalCache('contract_templates', list);
        return list;
      }
    } catch (e) {
      console.warn('Reading local contract templates:', e);
    }
    const cached = getLocalCache<ContractTemplate[]>('contract_templates', [DEFAULT_CONTRACT_TEMPLATE]);
    return cached.length ? cached : [DEFAULT_CONTRACT_TEMPLATE];
  }

  static async saveContractTemplate(template: ContractTemplate, userEmail: string): Promise<void> {
    const current = getLocalCache<ContractTemplate[]>('contract_templates', [DEFAULT_CONTRACT_TEMPLATE]);
    const filtered = current.filter(t => t.id !== template.id);
    setLocalCache('contract_templates', [template, ...filtered]);
    try {
      await setDoc(doc(db, 'contract_templates', template.id), template);
    } catch (e) {
      console.warn('Contract template saved locally:', e);
    }
    await this.logAudit(userEmail, 'TEMPLATE_CONTRATO_SALVO', 'contract_templates', template.id, template.name);
  }

  // ==========================================
  // INVOICES & PAYMENTS (MULTIEMPRESA)
  // ==========================================
  static async getInvoices(companyId?: string, branchId?: string): Promise<Invoice[]> {
    let list: Invoice[] = [];
    try {
      const snap = await getDocs(collection(db, 'invoices'));
      if (!snap.empty) {
        list = snap.docs.map(d => d.data() as Invoice);
        setLocalCache('invoices', list);
      } else {
        list = getLocalCache<Invoice[]>('invoices', []);
      }
    } catch (e) {
      console.warn('Reading local invoices:', e);
      list = getLocalCache<Invoice[]>('invoices', []);
    }

    list = list.map(i => ({
      ...i,
      companyId: i.companyId || 'company-matriz-01',
      branchId: i.branchId || 'branch-matriz-01',
    }));

    if (companyId && companyId !== 'TODAS') {
      list = list.filter(i => i.companyId === companyId);
    }
    if (branchId && branchId !== 'TODAS') {
      list = list.filter(i => i.branchId === branchId);
    }

    return list;
  }

  static async saveInvoice(invoice: Invoice, userEmail: string): Promise<void> {
    const isNew = !invoice.createdAt;
    const now = new Date().toISOString();
    const toSave: Invoice = {
      ...invoice,
      companyId: invoice.companyId || 'company-matriz-01',
      branchId: invoice.branchId || 'branch-matriz-01',
      createdAt: invoice.createdAt || now,
      updatedAt: now,
    };
    const current = getLocalCache<Invoice[]>('invoices', []);
    const filtered = current.filter(i => i.id !== toSave.id);
    setLocalCache('invoices', [toSave, ...filtered]);

    try {
      await setDoc(doc(db, 'invoices', toSave.id), toSave);
    } catch (e) {
      console.warn('Invoice saved locally:', e);
    }

    await this.logAudit(
      userEmail,
      isNew ? 'COBRANCA_CRIADA' : 'COBRANCA_ATUALIZADA',
      'invoices',
      toSave.id,
      `Cobrança ${toSave.invoiceNumber} - R$ ${toSave.amount} (${toSave.status})`,
      toSave.companyId
    );
  }

  static async getPayments(companyId?: string): Promise<Payment[]> {
    let list: Payment[] = [];
    try {
      const snap = await getDocs(collection(db, 'payments'));
      if (!snap.empty) {
        list = snap.docs.map(d => d.data() as Payment);
        setLocalCache('payments', list);
      } else {
        list = getLocalCache<Payment[]>('payments', []);
      }
    } catch (e) {
      console.warn('Reading local payments:', e);
      list = getLocalCache<Payment[]>('payments', []);
    }

    list = list.map(p => ({
      ...p,
      companyId: p.companyId || 'company-matriz-01',
    }));

    if (companyId && companyId !== 'TODAS') {
      list = list.filter(p => p.companyId === companyId);
    }

    return list;
  }

  static async recordPayment(payment: Payment, userEmail: string): Promise<void> {
    const existing = await this.getPayments();
    const duplicate = existing.find(p => p.invoiceId === payment.invoiceId);
    if (duplicate) {
      throw new Error(`A fatura já possui um pagamento registrado (ID: ${duplicate.id}). Operação duplicada rejeitada.`);
    }

    const toSave: Payment = {
      ...payment,
      companyId: payment.companyId || 'company-matriz-01',
      createdAt: payment.createdAt || new Date().toISOString(),
      registeredBy: userEmail,
    };

    const current = getLocalCache<Payment[]>('payments', []);
    setLocalCache('payments', [toSave, ...current]);

    try {
      await setDoc(doc(db, 'payments', toSave.id), toSave);
    } catch (e) {
      console.warn('Payment saved locally:', e);
    }

    const invoices = await this.getInvoices();
    const targetInvoice = invoices.find(i => i.id === payment.invoiceId);
    if (targetInvoice) {
      targetInvoice.status = 'paga';
      targetInvoice.paidDate = payment.paymentDate;
      targetInvoice.paidAmount = payment.amount;
      targetInvoice.transactionReference = payment.transactionReference;
      await this.saveInvoice(targetInvoice, userEmail);
    }

    const customers = await this.getCustomers();
    const customer = customers.find(c => c.id === payment.customerId);
    if (customer && customer.partnerId) {
      await this.calculateCommissionForPayment(payment, customer.partnerId, userEmail);
    }

    await this.logAudit(
      userEmail,
      'PAGAMENTO_CONFIRMADO',
      'payments',
      toSave.id,
      `Pagamento de R$ ${toSave.amount} para fatura ${payment.invoiceId}. Ref: ${payment.transactionReference}`,
      toSave.companyId
    );
  }

  // ==========================================
  // PARTNERS & COMMISSIONS
  // ==========================================
  static async getPartners(): Promise<Partner[]> {
    try {
      const snap = await getDocs(collection(db, 'partners'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as Partner);
        setLocalCache('partners', list);
        return list;
      }
    } catch (e) {
      console.warn('Reading local partners:', e);
    }
    return getLocalCache<Partner[]>('partners', []);
  }

  static async savePartner(partner: Partner, userEmail: string): Promise<void> {
    const isNew = !partner.createdAt;
    const toSave: Partner = {
      ...partner,
      createdAt: partner.createdAt || new Date().toISOString(),
    };
    const current = getLocalCache<Partner[]>('partners', []);
    const filtered = current.filter(p => p.id !== toSave.id);
    setLocalCache('partners', [toSave, ...filtered]);

    try {
      await setDoc(doc(db, 'partners', toSave.id), toSave);
    } catch (e) {
      console.warn('Partner saved locally:', e);
    }

    await this.logAudit(
      userEmail,
      isNew ? 'PARCEIRO_CRIADO' : 'PARCEIRO_ATUALIZADO',
      'partners',
      toSave.id,
      `Parceiro ${toSave.name} (${toSave.code})`
    );
  }

  static async getCommissions(): Promise<Commission[]> {
    try {
      const snap = await getDocs(collection(db, 'commissions'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as Commission);
        setLocalCache('commissions', list);
        return list;
      }
    } catch (e) {
      console.warn('Reading local commissions:', e);
    }
    return getLocalCache<Commission[]>('commissions', []);
  }

  static async calculateCommissionForPayment(
    payment: Payment,
    partnerId: string,
    userEmail: string
  ): Promise<Commission | null> {
    const partners = await this.getPartners();
    const partner = partners.find(p => p.id === partnerId);
    if (!partner || partner.status !== 'ativo') return null;

    const existing = await this.getCommissions();
    const hasExisting = existing.some(c => c.invoiceId === payment.invoiceId && c.partnerId === partnerId);
    if (hasExisting) return null;

    let commissionVal = 0;
    if (partner.commissionRuleType === 'percentual' || partner.commissionRuleType === 'misto') {
      commissionVal += (payment.amount * (partner.defaultCommissionRate || 0)) / 100;
    }
    if (partner.commissionRuleType === 'fixo' || partner.commissionRuleType === 'misto') {
      commissionVal += partner.defaultFixedAmount || 0;
    }

    if (commissionVal <= 0) return null;

    const commission: Commission = {
      id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      partnerId,
      customerId: payment.customerId,
      invoiceId: payment.invoiceId,
      eligiblePaymentAmount: payment.amount,
      commissionAmount: Number(commissionVal.toFixed(2)),
      status: 'calculada',
      calculationDate: getTodaySaoPaulo(),
      createdAt: new Date().toISOString(),
    };

    const current = getLocalCache<Commission[]>('commissions', []);
    setLocalCache('commissions', [commission, ...current]);

    try {
      await setDoc(doc(db, 'commissions', commission.id), commission);
    } catch (e) {
      console.warn('Commission saved locally:', e);
    }

    await this.logAudit(
      userEmail,
      'COMISSAO_CALCULADA',
      'commissions',
      commission.id,
      `Comissão de R$ ${commission.commissionAmount} calculada para parceiro ${partner.name}`
    );

    return commission;
  }

  static async updateCommissionStatus(
    commissionId: string,
    status: Commission['status'],
    userEmail: string
  ): Promise<void> {
    const current = await this.getCommissions();
    const item = current.find(c => c.id === commissionId);
    if (!item) return;

    item.status = status;
    if (status === 'paga') {
      item.paidDate = getTodaySaoPaulo();
    } else if (status === 'estornada') {
      item.reversalDate = getTodaySaoPaulo();
    }

    const filtered = current.filter(c => c.id !== commissionId);
    setLocalCache('commissions', [item, ...filtered]);

    try {
      await setDoc(doc(db, 'commissions', item.id), item);
    } catch (e) {
      console.warn('Commission status saved locally:', e);
    }

    await this.logAudit(
      userEmail,
      'COMISSAO_STATUS_ALTERADO',
      'commissions',
      item.id,
      `Comissão alterada para status ${status}`
    );
  }

  // ==========================================
  // EMPLOYEES & USERS (RBAC MULTIEMPRESA)
  // ==========================================
  static async getEmployees(companyId?: string, branchId?: string): Promise<EmployeeProfile[]> {
    let list: EmployeeProfile[] = [];
    try {
      const snap = await getDocs(collection(db, 'employee_profiles'));
      if (!snap.empty) {
        list = snap.docs.map(d => d.data() as EmployeeProfile);
        setLocalCache('employee_profiles', list);
      } else {
        list = getLocalCache<EmployeeProfile[]>('employee_profiles', []);
      }
    } catch (e) {
      console.warn('Reading local employees:', e);
      list = getLocalCache<EmployeeProfile[]>('employee_profiles', []);
    }

    if (companyId && companyId !== 'TODAS') {
      list = list.filter(e => !e.companyId || e.companyId === companyId);
    }
    if (branchId && branchId !== 'TODAS') {
      list = list.filter(e => !e.branchId || e.branchId === branchId);
    }

    return list;
  }

  static async saveEmployee(emp: EmployeeProfile, userEmail: string): Promise<void> {
    const isNew = !emp.createdAt;
    const toSave: EmployeeProfile = {
      ...emp,
      createdAt: emp.createdAt || new Date().toISOString(),
    };
    const current = getLocalCache<EmployeeProfile[]>('employee_profiles', []);
    const filtered = current.filter(e => e.id !== toSave.id);
    setLocalCache('employee_profiles', [toSave, ...filtered]);

    try {
      await setDoc(doc(db, 'employee_profiles', toSave.id), toSave);
    } catch (e) {
      console.warn('Employee saved locally:', e);
    }

    await this.logAudit(
      userEmail,
      isNew ? 'USUARIO_CRIADO' : 'USUARIO_ATUALIZADO',
      'employee_profiles',
      toSave.id,
      `Perfil ${toSave.name} (${toSave.email}) - Função: ${toSave.role} - Empresa: ${toSave.companyId || 'Global'}`,
      toSave.companyId,
      toSave.branchId
    );
  }

  static async deleteEmployee(employeeId: string, userEmail: string): Promise<void> {
    const current = getLocalCache<EmployeeProfile[]>('employee_profiles', []);
    const emp = current.find(e => e.id === employeeId);
    setLocalCache('employee_profiles', current.filter(e => e.id !== employeeId));
    try {
      await deleteDoc(doc(db, 'employee_profiles', employeeId));
    } catch (e) {
      console.warn('Delete employee error:', e);
    }
    await this.logAudit(userEmail, 'USUARIO_REMOVIDO', 'employee_profiles', employeeId, 'Usuário desativado/removido', emp?.companyId);
  }

  // ==========================================
  // MESSAGE LOGS (WHATSAPP)
  // ==========================================
  static async getMessageLogs(): Promise<MessageLog[]> {
    try {
      const snap = await getDocs(query(collection(db, 'message_logs'), orderBy('sentAt', 'desc'), limit(150)));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as MessageLog);
        setLocalCache('message_logs', list);
        return list;
      }
    } catch (e) {
      console.warn('Reading local message logs:', e);
    }
    return getLocalCache<MessageLog[]>('message_logs', []);
  }

  static async logMessage(log: MessageLog, userEmail: string): Promise<void> {
    const current = getLocalCache<MessageLog[]>('message_logs', []);
    setLocalCache('message_logs', [log, ...current]);
    try {
      await setDoc(doc(db, 'message_logs', log.id), log);
    } catch (e) {
      console.warn('Message log saved locally:', e);
    }
    await this.logAudit(userEmail, 'MENSAGEM_DISPARADA', 'message_logs', log.id, `Mensagem ${log.messageType} para ${log.customerName}`);
  }

  // ==========================================
  // RECURRENCE ENGINE RUNNER
  // ==========================================
  static async runRecurrenceEngine(userEmail = 'sistema'): Promise<{
    invoicesGenerated: number;
    remindersFound: number;
    invoicesOverdueUpdated: number;
  }> {
    const today = getTodaySaoPaulo();
    const subscriptions = await this.getSubscriptions();
    const invoices = await this.getInvoices();
    const plans = await this.getPlans();
    const customers = await this.getCustomers();

    let invoicesGenerated = 0;
    let remindersFound = 0;
    let invoicesOverdueUpdated = 0;

    for (const inv of invoices) {
      if (inv.status === 'pendente' || inv.status === 'agendada' || inv.status === 'enviada') {
        const diff = getDaysDiff(inv.dueDate, today);
        if (diff < 0) {
          inv.status = 'vencida';
          inv.updatedAt = new Date().toISOString();
          invoicesOverdueUpdated++;
          await this.saveInvoice(inv, userEmail);
        }
      }
    }

    const activeSubs = subscriptions.filter(s => s.status === 'ativa');
    for (const sub of activeSubs) {
      if (!sub.nextDueDate) continue;

      const diff = getDaysDiff(sub.nextDueDate, today);
      if (diff <= 30) {
        const refPeriod = getReferencePeriod(sub.nextDueDate);
        const existingInvoice = invoices.find(
          i => i.subscriptionId === sub.id && i.dueDate === sub.nextDueDate
        );

        if (!existingInvoice) {
          const plan = plans.find(p => p.id === sub.planId);
          const customer = customers.find(c => c.id === sub.customerId);
          const invNum = `FAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

          const newInvoice: Invoice = {
            id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            invoiceNumber: invNum,
            customerId: sub.customerId,
            companyId: sub.companyId || customer?.companyId || 'company-matriz-01',
            branchId: sub.branchId || customer?.branchId || 'branch-matriz-01',
            subscriptionId: sub.id,
            planId: sub.planId,
            amount: sub.contractValue,
            issueDate: today,
            dueDate: sub.nextDueDate,
            referencePeriod: refPeriod,
            description: `Mensalidade ${plan?.name || 'Plano'} - Ciclo ${sub.billingCycle}`,
            paymentMethod: 'PIX',
            status: diff < 0 ? 'vencida' : 'pendente',
            reminderStatus: diff === 2 ? 'pendente_d2' : 'nenhum',
            createdAt: new Date().toISOString(),
          };

          await this.saveInvoice(newInvoice, userEmail);
          invoicesGenerated++;

          sub.nextDueDate = calculateNextDueDate(sub.nextDueDate, sub.billingCycle);
          await this.saveSubscription(sub, userEmail);
        }
      }
    }

    const updatedInvoices = await this.getInvoices();
    for (const inv of updatedInvoices) {
      if (inv.status === 'pendente' || inv.status === 'enviada') {
        const diff = getDaysDiff(inv.dueDate, today);
        if (diff === 2) {
          remindersFound++;
        }
      }
    }

    return { invoicesGenerated, remindersFound, invoicesOverdueUpdated };
  }

  // Seed baseline data preserving all existing data
  static async seedInitialDataIfEmpty(userEmail: string): Promise<void> {
    // 1. Seed companies and branches
    const companies = await this.getCompanies();
    if (companies.length === 0) {
      for (const comp of INITIAL_COMPANIES) {
        await this.saveCompany(comp, userEmail);
      }
    }
    const branches = await this.getBranches();
    if (branches.length === 0) {
      for (const br of INITIAL_BRANCHES) {
        await this.saveBranch(br, userEmail);
      }
    }

    const customers = await this.getCustomers();
    if (customers.length > 0) return; // Already has customer data

    const today = getTodaySaoPaulo();

    // Partners
    const samplePartner: Partner = {
      id: 'partner-1',
      code: 'PARC-001',
      name: 'Alpha Telecom & Mídia',
      docNumber: '12.345.678/0001-90',
      whatsapp: '+55 (11) 97111-2233',
      email: 'contato@alphatelecom.com.br',
      address: 'Rua Vergueiro, 500 - Paraíso, São Paulo - SP',
      joinDate: '2026-01-10',
      commissionRuleType: 'percentual',
      defaultCommissionRate: 10,
      defaultFixedAmount: 0,
      status: 'ativo',
      contactInfo: 'Roberto Silva (Gerente Comercial)',
      notes: 'Parceiro comissionado mensalmente sobre mensalidades confirmadas.',
      createdAt: '2026-01-10',
    };
    await this.savePartner(samplePartner, userEmail);

    // Initial Customers linked to Matriz and Branches
    const sampleCustomer1: Customer = {
      id: 'cust-1',
      code: 'ONX-001',
      name: 'Carlos Eduardo Oliveira',
      cpf: '29845187834',
      whatsapp: '+55 (11) 98877-6655',
      email: 'carlos.eduardo@email.com',
      cep: '04538-132',
      street: 'Rua Joaquim Floriano',
      number: '466',
      complement: 'Apto 102',
      neighborhood: 'Itaim Bibi',
      city: 'São Paulo',
      state: 'SP',
      reference: 'Próximo à Av. Brigadeiro Faria Lima',
      registrationDate: '2026-02-01',
      source: 'Indicação',
      companyId: 'company-matriz-01',
      branchId: 'branch-matriz-01',
      partnerId: samplePartner.id,
      notes: 'Cliente corporativo com 4 terminais habilitados.',
      status: 'ativo',
      dataConsent: true,
      createdAt: '2026-02-01',
    };

    const sampleCustomer2: Customer = {
      id: 'cust-2',
      code: 'ONX-002',
      name: 'Mariana Santos Rodrigues',
      cpf: '38192047812',
      whatsapp: '+55 (11) 97766-5544',
      email: 'mariana.rodrigues@email.com',
      cep: '01414-001',
      street: 'Alameda Santos',
      number: '1293',
      complement: 'Conjunto 41',
      neighborhood: 'Cerqueira César',
      city: 'São Paulo',
      state: 'SP',
      reference: 'Esquina com Rua Bela Cintra',
      registrationDate: '2026-02-15',
      source: 'Instagram',
      companyId: 'company-matriz-01',
      branchId: 'branch-campinas-02',
      notes: 'Plano anual - faturamento por PIX.',
      status: 'ativo',
      dataConsent: true,
      createdAt: '2026-02-15',
    };

    const sampleCustomer3: Customer = {
      id: 'cust-3',
      code: 'ONX-003',
      name: 'Lucas Ferreira Mendes',
      cpf: '41289053890',
      whatsapp: '+55 (11) 96655-4433',
      email: 'lucas.fmendes@email.com',
      cep: '05407-002',
      street: 'Rua Teodoro Sampaio',
      number: '2100',
      neighborhood: 'Pinheiros',
      city: 'São Paulo',
      state: 'SP',
      registrationDate: '2026-03-01',
      source: 'Google',
      companyId: 'company-parceira-02',
      branchId: 'branch-techplay-rj',
      notes: 'Cliente atendido pela filial Rio de Janeiro da TechPlay.',
      status: 'pendente',
      dataConsent: true,
      createdAt: '2026-03-01',
    };

    await this.saveCustomer(sampleCustomer1, userEmail);
    await this.saveCustomer(sampleCustomer2, userEmail);
    await this.saveCustomer(sampleCustomer3, userEmail);

    // Subscriptions
    const sub1: Subscription = {
      id: 'sub-1',
      customerId: sampleCustomer1.id,
      companyId: 'company-matriz-01',
      branchId: 'branch-matriz-01',
      planId: 'plan-basic',
      startDate: '2026-02-01',
      firstDueDate: '2026-02-10',
      nextDueDate: calculateNextDueDate(today, 'mensal'),
      contractValue: 39.9,
      discountApplied: 0,
      billingCycle: 'mensal',
      autoRenew: true,
      status: 'ativa',
      createdAt: '2026-02-01',
    };

    const sub2: Subscription = {
      id: 'sub-2',
      customerId: sampleCustomer2.id,
      companyId: 'company-matriz-01',
      branchId: 'branch-campinas-02',
      planId: 'plan-black',
      startDate: '2026-02-15',
      firstDueDate: '2026-02-15',
      nextDueDate: calculateNextDueDate(today, 'anual'),
      contractValue: 359.0,
      discountApplied: 0,
      billingCycle: 'anual',
      autoRenew: true,
      status: 'ativa',
      createdAt: '2026-02-15',
    };

    await this.saveSubscription(sub1, userEmail);
    await this.saveSubscription(sub2, userEmail);

    // Sample Invoices
    const [y, m, d] = today.split('-').map(Number);
    const d2Date = new Date(Date.UTC(y, m - 1, d + 2)).toISOString().slice(0, 10);

    const inv1: Invoice = {
      id: 'inv-1',
      invoiceNumber: 'FAT-2026-0001',
      customerId: sampleCustomer1.id,
      companyId: 'company-matriz-01',
      branchId: 'branch-matriz-01',
      subscriptionId: sub1.id,
      planId: 'plan-basic',
      amount: 39.9,
      issueDate: '2026-02-01',
      dueDate: '2026-02-10',
      referencePeriod: 'Fevereiro/2026',
      description: 'Mensalidade ONNIX Silver - Unidade Jardins',
      paymentMethod: 'PIX',
      status: 'paga',
      paidDate: '2026-02-09',
      paidAmount: 39.9,
      transactionReference: 'E18239019283921829038102',
      createdAt: '2026-02-01',
    };

    const inv2: Invoice = {
      id: 'inv-2',
      invoiceNumber: 'FAT-2026-0002',
      customerId: sampleCustomer1.id,
      companyId: 'company-matriz-01',
      branchId: 'branch-matriz-01',
      subscriptionId: sub1.id,
      planId: 'plan-basic',
      amount: 39.9,
      issueDate: today,
      dueDate: d2Date,
      referencePeriod: getReferencePeriod(d2Date),
      description: 'Mensalidade ONNIX Silver - Próximo Vencimento (D-2)',
      paymentMethod: 'PIX',
      status: 'pendente',
      reminderStatus: 'pendente_d2',
      createdAt: today,
    };

    const inv3: Invoice = {
      id: 'inv-3',
      invoiceNumber: 'FAT-2026-0003',
      customerId: sampleCustomer3.id,
      companyId: 'company-parceira-02',
      branchId: 'branch-techplay-rj',
      planId: 'plan-basic',
      amount: 39.9,
      issueDate: '2026-03-01',
      dueDate: '2026-03-05',
      referencePeriod: 'Março/2026',
      description: 'Mensalidade ONNIX Silver - Vencida',
      paymentMethod: 'PIX',
      status: 'vencida',
      reminderStatus: 'aviso_vencido_enviado',
      createdAt: '2026-03-01',
    };

    await this.saveInvoice(inv1, userEmail);
    await this.saveInvoice(inv2, userEmail);
    await this.saveInvoice(inv3, userEmail);

    // Confirmed payment
    const payment1: Payment = {
      id: 'pay-1',
      invoiceId: inv1.id,
      customerId: sampleCustomer1.id,
      companyId: 'company-matriz-01',
      branchId: 'branch-matriz-01',
      amount: 39.9,
      paymentDate: '2026-02-09',
      paymentMethod: 'PIX',
      transactionReference: 'E18239019283921829038102',
      registeredBy: userEmail,
      notes: 'Baixa confirmada via extrato bancário',
      createdAt: '2026-02-09',
    };
    await this.recordPayment(payment1, userEmail);

    // Initial Contract
    const sampleContract: Contract = {
      id: 'ctr-1',
      documentNumber: 'ONX-CTR-2026-001',
      customerId: sampleCustomer1.id,
      companyId: 'company-matriz-01',
      branchId: 'branch-matriz-01',
      subscriptionId: sub1.id,
      templateId: DEFAULT_CONTRACT_TEMPLATE.id,
      title: 'Contrato de Adesão - Plano ONNIX Silver',
      content: DEFAULT_CONTRACT_TEMPLATE.templateContent
        .replace(/{{empresa_nome}}/g, DEFAULT_COMPANY_SETTINGS.companyName)
        .replace(/{{empresa_cnpj}}/g, DEFAULT_COMPANY_SETTINGS.cnpj)
        .replace(/{{empresa_endereco}}/g, DEFAULT_COMPANY_SETTINGS.address)
        .replace(/{{nome_filial}}/g, 'Unidade Central Jardins (SP)')
        .replace(/{{nome_cliente}}/g, sampleCustomer1.name)
        .replace(/{{cpf_cliente}}/g, sampleCustomer1.cpf)
        .replace(/{{endereco_cliente}}/g, `${sampleCustomer1.street}, ${sampleCustomer1.number} - ${sampleCustomer1.neighborhood}, ${sampleCustomer1.city}/${sampleCustomer1.state}`)
        .replace(/{{nome_plano}}/g, 'ONNIX Silver')
        .replace(/{{valor_contratado}}/g, 'R$ 39,90')
        .replace(/{{periodicidade}}/g, 'Mensal')
        .replace(/{{data_vencimento}}/g, '10/02/2026')
        .replace(/{{data_inicio}}/g, '01/02/2026')
        .replace(/{{data_final}}/g, '01/02/2027')
        .replace(/{{data_atual}}/g, today),
      terms: DEFAULT_CONTRACT_TEMPLATE.defaultClauses,
      dynamicValues: {
        nome_cliente: sampleCustomer1.name,
        cpf_cliente: sampleCustomer1.cpf,
        nome_plano: 'ONNIX Silver',
        valor_contratado: 'R$ 39,90',
      },
      status: 'ativo',
      issuedAt: '2026-02-01',
      startDate: '2026-02-01',
      endDate: '2027-02-01',
      contractValue: 39.9,
      version: 1,
      createdAt: '2026-02-01',
    };
    await this.saveContract(sampleContract, userEmail);
  }
}
