/**
 * Firestore Database Service and Local Persistent Fallback
 * Implements strict CRUD, audit logging, recurrence engine, and seed configuration
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
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
  ReminderJob,
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
  name: 'Contrato Padrão de Assinatura ONNIX PLAY',
  description: 'Modelo oficial para contratações mensais, trimestrais e anuais',
  isDefault: true,
  createdAt: '2026-01-01',
  defaultClauses: `CLÁUSULA 1ª - DO OBJETO: O presente contrato tem por objeto a prestação de serviços de assinatura do plano {{nome_plano}} pela CONTRATADA ao CONTRATANTE.
CLÁUSULA 2ª - DO VALOR E PAGAMENTO: O CONTRATANTE pagará à CONTRATADA o valor contratado de {{valor_contratado}} com periodicidade {{periodicidade}}, sendo o primeiro vencimento em {{data_vencimento}}.
CLÁUSULA 3ª - DA VIGÊNCIA E RENOVAÇÃO: O presente contrato tem início em {{data_inicio}} e término previsto em {{data_final}}, renovando-se automaticamente sob as mesmas condições, salvo manifestação em contrário com 15 dias de antecedência.
CLÁUSULA 4ª - DA RESCISÃO E CANCELAMENTO: O cancelamento poderá ser solicitado a qualquer momento pelo CONTRATANTE, respeitadas eventuais faturas emitidas e proporcionais devidos.
CLÁUSULA 5ª - DO TRATAMENTO DE DADOS (LGPD): As partes declaram ciência e conformidade com as diretrizes da Lei nº 13.709/2018 (LGPD), destinando os dados exclusivamente à execução contratual.`,
  templateContent: `INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS E ASSINATURA

CONTRATADA: {{empresa_nome}}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {{empresa_cnpj}}, com sede em {{empresa_endereco}}.

CONTRATANTE: {{nome_cliente}}, inscrito(a) no CPF sob o nº {{cpf_cliente}}, residente e domiciliado(a) em {{endereco_cliente}}.

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
    details: string
  ): Promise<void> {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userEmail,
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

  static async getAuditLogs(): Promise<AuditLog[]> {
    try {
      const snap = await getDocs(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100)));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as AuditLog);
        setLocalCache('audit_logs', list);
        return list;
      }
    } catch (e) {
      console.warn('Fallback to cached audit logs:', e);
    }
    return getLocalCache<AuditLog[]>('audit_logs', []);
  }

  // Customers
  static async getCustomers(): Promise<Customer[]> {
    try {
      const snap = await getDocs(collection(db, 'customers'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as Customer);
        setLocalCache('customers', list);
        return list;
      }
    } catch (e) {
      console.warn('Reading local customers cache:', e);
    }
    return getLocalCache<Customer[]>('customers', []);
  }

  static async saveCustomer(customer: Customer, userEmail: string): Promise<void> {
    const isNew = !customer.createdAt;
    const now = new Date().toISOString();
    const toSave: Customer = {
      ...customer,
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
      `Cliente ${toSave.name} (${toSave.code})`
    );
  }

  static async deleteCustomer(customerId: string, userEmail: string): Promise<void> {
    const current = getLocalCache<Customer[]>('customers', []);
    setLocalCache('customers', current.filter(c => c.id !== customerId));
    try {
      await deleteDoc(doc(db, 'customers', customerId));
    } catch (e) {
      console.warn('Delete customer remote error:', e);
    }
    await this.logAudit(userEmail, 'CLIENTE_EXCLUIDO', 'customers', customerId, 'Registro de cliente removido');
  }

  // Plans
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

  // Subscriptions
  static async getSubscriptions(): Promise<Subscription[]> {
    try {
      const snap = await getDocs(collection(db, 'subscriptions'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as Subscription);
        setLocalCache('subscriptions', list);
        return list;
      }
    } catch (e) {
      console.warn('Reading local subscriptions:', e);
    }
    return getLocalCache<Subscription[]>('subscriptions', []);
  }

  static async saveSubscription(sub: Subscription, userEmail: string): Promise<void> {
    const toSave: Subscription = {
      ...sub,
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
      `Assinatura para cliente ${toSave.customerId} - ciclo ${toSave.billingCycle}`
    );
  }

  // Contracts
  static async getContracts(): Promise<Contract[]> {
    try {
      const snap = await getDocs(collection(db, 'contracts'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as Contract);
        setLocalCache('contracts', list);
        return list;
      }
    } catch (e) {
      console.warn('Reading local contracts:', e);
    }
    return getLocalCache<Contract[]>('contracts', []);
  }

  static async saveContract(contract: Contract, userEmail: string): Promise<void> {
    const isNew = !contract.createdAt;
    const now = new Date().toISOString();
    const toSave: Contract = {
      ...contract,
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
      `Contrato ${toSave.documentNumber} (${toSave.status})`
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

  // Invoices
  static async getInvoices(): Promise<Invoice[]> {
    try {
      const snap = await getDocs(collection(db, 'invoices'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as Invoice);
        setLocalCache('invoices', list);
        return list;
      }
    } catch (e) {
      console.warn('Reading local invoices:', e);
    }
    return getLocalCache<Invoice[]>('invoices', []);
  }

  static async saveInvoice(invoice: Invoice, userEmail: string): Promise<void> {
    const isNew = !invoice.createdAt;
    const now = new Date().toISOString();
    const toSave: Invoice = {
      ...invoice,
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
      `Cobrança ${toSave.invoiceNumber} - R$ ${toSave.amount} (${toSave.status})`
    );
  }

  // Payments
  static async getPayments(): Promise<Payment[]> {
    try {
      const snap = await getDocs(collection(db, 'payments'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as Payment);
        setLocalCache('payments', list);
        return list;
      }
    } catch (e) {
      console.warn('Reading local payments:', e);
    }
    return getLocalCache<Payment[]>('payments', []);
  }

  static async recordPayment(payment: Payment, userEmail: string): Promise<void> {
    // Check for double payment on the same invoice
    const existing = await this.getPayments();
    const duplicate = existing.find(p => p.invoiceId === payment.invoiceId);
    if (duplicate) {
      throw new Error(`A fatura já possui um pagamento registrado (ID: ${duplicate.id}). Operação duplicada rejeitada.`);
    }

    const toSave: Payment = {
      ...payment,
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

    // Update the invoice status to 'paga'
    const invoices = await this.getInvoices();
    const targetInvoice = invoices.find(i => i.id === payment.invoiceId);
    if (targetInvoice) {
      targetInvoice.status = 'paga';
      targetInvoice.paidDate = payment.paymentDate;
      targetInvoice.paidAmount = payment.amount;
      targetInvoice.transactionReference = payment.transactionReference;
      await this.saveInvoice(targetInvoice, userEmail);
    }

    // Check if customer had partner referral, compute eligible commission
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
      `Pagamento de R$ ${toSave.amount} para fatura ${payment.invoiceId}. Ref: ${payment.transactionReference}`
    );
  }

  // Partners & Commissions
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

    // Check duplicate commission for the same payment
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

  // Employees & RBAC
  static async getEmployees(): Promise<EmployeeProfile[]> {
    try {
      const snap = await getDocs(collection(db, 'employee_profiles'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as EmployeeProfile);
        setLocalCache('employee_profiles', list);
        return list;
      }
    } catch (e) {
      console.warn('Reading local employees:', e);
    }
    return getLocalCache<EmployeeProfile[]>('employee_profiles', []);
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
      isNew ? 'FUNCIONARIO_CRIADO' : 'FUNCIONARIO_ATUALIZADO',
      'employee_profiles',
      toSave.id,
      `Funcionário ${toSave.name} (${toSave.email}) com ${toSave.permissions.length} permissões`
    );
  }

  static async deleteEmployee(employeeId: string, userEmail: string): Promise<void> {
    const current = getLocalCache<EmployeeProfile[]>('employee_profiles', []);
    setLocalCache('employee_profiles', current.filter(e => e.id !== employeeId));
    try {
      await deleteDoc(doc(db, 'employee_profiles', employeeId));
    } catch (e) {
      console.warn('Delete employee error:', e);
    }
    await this.logAudit(userEmail, 'FUNCIONARIO_REMOVIDO', 'employee_profiles', employeeId, 'Funcionário desativado/removido');
  }

  // Message Logs (WhatsApp & Communications)
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

  // Recurrence Engine Runner (Background routine simulation)
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

    // 1. Mark overdue invoices that have passed due date and are still pending
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

    // 2. Check active subscriptions and generate next cycle invoice if near due date (< 7 days) and not already generated
    const activeSubs = subscriptions.filter(s => s.status === 'ativa');
    for (const sub of activeSubs) {
      if (!sub.nextDueDate) continue;

      const diff = getDaysDiff(sub.nextDueDate, today);
      // If due date is within next 30 days or overdue, ensure an invoice exists for this period
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

          // Advance subscription's next due date according to billing cycle
          sub.nextDueDate = calculateNextDueDate(sub.nextDueDate, sub.billingCycle);
          await this.saveSubscription(sub, userEmail);
        }
      }
    }

    // 3. Count upcoming D-2 reminders
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

  // Seed sample initial data if database is empty
  static async seedInitialDataIfEmpty(userEmail: string): Promise<void> {
    const customers = await this.getCustomers();
    if (customers.length > 0) return; // Already has data

    const today = getTodaySaoPaulo();

    // 1. Initial Partners
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

    // 2. Initial Sample Customers
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
      partnerId: samplePartner.id,
      notes: 'Cliente prioritário - solicitou suporte para 4 dispositivos.',
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
      notes: 'Pagamento pendente de regularização.',
      status: 'pendente',
      dataConsent: true,
      createdAt: '2026-03-01',
    };

    await this.saveCustomer(sampleCustomer1, userEmail);
    await this.saveCustomer(sampleCustomer2, userEmail);
    await this.saveCustomer(sampleCustomer3, userEmail);

    // 3. Subscriptions
    const sub1: Subscription = {
      id: 'sub-1',
      customerId: sampleCustomer1.id,
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

    // 4. Sample Invoices (Confirmed and Upcoming)
    // Target a date exactly 2 days from now for testing the D-2 reminder engine!
    const [y, m, d] = today.split('-').map(Number);
    const d2Date = new Date(Date.UTC(y, m - 1, d + 2)).toISOString().slice(0, 10);

    const inv1: Invoice = {
      id: 'inv-1',
      invoiceNumber: 'FAT-2026-0001',
      customerId: sampleCustomer1.id,
      subscriptionId: sub1.id,
      planId: 'plan-basic',
      amount: 39.9,
      issueDate: '2026-02-01',
      dueDate: '2026-02-10',
      referencePeriod: 'Fevereiro/2026',
      description: 'Mensalidade ONNIX Silver - Fevereiro/2026',
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
      subscriptionId: sub1.id,
      planId: 'plan-basic',
      amount: 39.9,
      issueDate: today,
      dueDate: d2Date, // exactly D-2!
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

    // 5. Payment for inv-1 and commission
    const payment1: Payment = {
      id: 'pay-1',
      invoiceId: inv1.id,
      customerId: sampleCustomer1.id,
      amount: 39.9,
      paymentDate: '2026-02-09',
      paymentMethod: 'PIX',
      transactionReference: 'E18239019283921829038102',
      registeredBy: userEmail,
      notes: 'Baixa confirmada via extrato bancário',
      createdAt: '2026-02-09',
    };
    await this.recordPayment(payment1, userEmail);

    // 6. Sample Initial Contract
    const sampleContract: Contract = {
      id: 'ctr-1',
      documentNumber: 'ONX-CTR-2026-001',
      customerId: sampleCustomer1.id,
      subscriptionId: sub1.id,
      templateId: DEFAULT_CONTRACT_TEMPLATE.id,
      title: 'Contrato de Adesão - Plano ONNIX Silver',
      content: DEFAULT_CONTRACT_TEMPLATE.templateContent
        .replace(/{{empresa_nome}}/g, DEFAULT_COMPANY_SETTINGS.companyName)
        .replace(/{{empresa_cnpj}}/g, DEFAULT_COMPANY_SETTINGS.cnpj)
        .replace(/{{empresa_endereco}}/g, DEFAULT_COMPANY_SETTINGS.address)
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
      status: 'emitido',
      issuedAt: '2026-02-01',
      version: 1,
      createdAt: '2026-02-01',
    };
    await this.saveContract(sampleContract, userEmail);
  }
}
