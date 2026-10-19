/**
 * Types and Data Contracts for ONNIX PLAY Gestão
 */

export type UserRole = 'MASTER_OWNER' | 'EMPLOYEE';

export type UserStatus = 'ativo' | 'inativo';

export type PermissionKey =
  | 'consultar_clientes'
  | 'cadastrar_clientes'
  | 'editar_clientes'
  | 'consultar_contratos'
  | 'emitir_contratos'
  | 'consultar_cobrancas'
  | 'registrar_pagamentos'
  | 'consultar_relatorios'
  | 'administrar_parceiros'
  | 'consultar_comissoes'
  | 'exportar_dados';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  isTwoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface EmployeeProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string; // e.g. "Gerente Comercial", "Atendente", "Operador Financeiro"
  status: UserStatus;
  permissions: PermissionKey[];
  createdAt: string;
  createdBy: string;
}

export type CustomerStatus = 'ativo' | 'inativo' | 'pendente' | 'inadimplente';

export interface Customer {
  id: string;
  code: string; // e.g., ONX-001
  name: string;
  cpf: string;
  whatsapp: string; // E.164 or formatted with country code
  email?: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  reference?: string;
  registrationDate: string;
  source: string; // "Indicação", "Instagram", "Google", "WhatsApp", etc.
  employeeResponsibleId?: string;
  partnerId?: string;
  notes?: string;
  status: CustomerStatus;
  dataConsent: boolean; // LGPD consent
  createdAt: string;
  updatedAt?: string;
}

export type BillingCycle = 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'personalizado';

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number; // in BRL float or centavos, we handle in standard currency format
  billingCycle: BillingCycle;
  durationMonths: number;
  renewalRules: string;
  terms: string;
  additionalFees: number;
  allowedDiscounts: number;
  status: 'ativo' | 'inativo';
  createdAt: string;
}

export type SubscriptionStatus = 'ativa' | 'cancelada' | 'suspensa' | 'finalizada';

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  startDate: string; // YYYY-MM-DD
  firstDueDate: string; // YYYY-MM-DD
  nextDueDate: string; // YYYY-MM-DD
  contractValue: number;
  discountApplied: number;
  billingCycle: BillingCycle;
  endDate?: string;
  autoRenew: boolean;
  customRules?: string;
  responsibleEmployeeId?: string;
  status: SubscriptionStatus;
  createdAt: string;
}

export type ContractStatus = 'rascunho' | 'emitido' | 'assinado' | 'cancelado';

export interface Contract {
  id: string;
  documentNumber: string; // e.g. ONX-CTR-2026-001
  customerId: string;
  subscriptionId?: string;
  templateId?: string;
  title: string;
  content: string; // complete contract text with replaced variables
  terms: string;
  dynamicValues: Record<string, string>;
  status: ContractStatus;
  issuedAt: string;
  signedAt?: string;
  signedBy?: string;
  version: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  templateContent: string;
  defaultClauses: string;
  isDefault: boolean;
  createdAt: string;
}

export type InvoiceStatus =
  | 'agendada'
  | 'pendente'
  | 'enviada'
  | 'vencida'
  | 'parcialmente_paga'
  | 'paga'
  | 'cancelada'
  | 'em_contestacao';

export type PaymentMethod = 'PIX' | 'Boleto' | 'Cartão' | 'Transferência' | 'Dinheiro';

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. FAT-2026-0001
  customerId: string;
  subscriptionId?: string;
  planId?: string;
  amount: number;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  referencePeriod: string; // e.g. "Outubro/2026"
  description: string;
  paymentMethod: PaymentMethod;
  status: InvoiceStatus;
  paidDate?: string;
  paidAmount?: number;
  transactionReference?: string;
  notes?: string;
  reminderStatus?: 'nenhum' | 'pendente_d2' | 'lembrete_enviado' | 'aviso_vencido_enviado';
  createdAt: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionReference: string;
  registeredBy: string; // user email
  notes?: string;
  createdAt: string;
}

export type PartnerStatus = 'ativo' | 'inativo';
export type CommissionRuleType = 'percentual' | 'fixo' | 'misto';

export interface Partner {
  id: string;
  code: string; // e.g. PARC-001
  name: string;
  docNumber: string; // CPF or CNPJ
  whatsapp: string;
  email: string;
  address?: string;
  joinDate: string;
  commissionRuleType: CommissionRuleType;
  defaultCommissionRate: number; // percentage (e.g. 10 for 10%)
  defaultFixedAmount: number; // fixed amount in BRL
  status: PartnerStatus;
  contactInfo?: string;
  notes?: string;
  createdAt: string;
}

export interface Referral {
  id: string;
  partnerId: string;
  customerId: string;
  referralDate: string;
  planId?: string;
  status: 'ativa' | 'cancelada';
  createdAt: string;
}

export type CommissionStatus = 'prevista' | 'calculada' | 'aprovada' | 'paga' | 'estornada';

export interface Commission {
  id: string;
  partnerId: string;
  referralId?: string;
  invoiceId: string;
  customerId: string;
  eligiblePaymentAmount: number;
  commissionAmount: number;
  status: CommissionStatus;
  calculationDate: string;
  paidDate?: string;
  reversalDate?: string;
  notes?: string;
  createdAt: string;
}

export interface ReminderJob {
  id: string;
  customerId: string;
  invoiceId: string;
  scheduledFor: string; // YYYY-MM-DD
  status: 'pendente' | 'enviado' | 'cancelado' | 'falha';
  messageType: 'lembrete_2_dias' | 'vencido' | 'confirmacao_pagamento' | 'contrato';
  messageContent: string;
  executedAt?: string;
  createdAt: string;
}

export interface MessageLog {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  messageType: 'lembrete_2_dias' | 'cobranca_vencida' | 'confirmacao_pagamento' | 'contrato_disponivel' | 'livre';
  channel: 'whatsapp_click' | 'whatsapp_api';
  content: string;
  status: 'preparada' | 'enviada' | 'entregue' | 'lida' | 'falha';
  sentAt: string;
  sentBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  timestamp: string;
}

export interface CompanySettings {
  companyName: string;
  tradeName: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  pixKey: string;
  pixKeyType: 'CNPJ' | 'Email' | 'Telefone' | 'Aleatoria';
  defaultPaymentTerms: string;
  reminderDaysBefore: number; // default 2
}

export interface WhatsAppApiSettings {
  enabled: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  permanentAccessToken: string;
  webhookVerifyToken: string;
  templateNamespace: string;
}

export interface MasterOwnerCredentials {
  email: string;
  passwordHash: string;
  salt: string;
  isConfigured: boolean;
  configuredAt?: string;
  twoFactorEnabled?: boolean;
  securityAnswerHash?: string;
}
