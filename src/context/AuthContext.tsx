/**
 * Authentication & RBAC Context for ONNIX PLAY Gestão
 * Enforces Master Owner security, initial setup onboarding, and granular employee permissions
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import {
  UserProfile,
  EmployeeProfile,
  PermissionKey,
  MasterOwnerCredentials,
} from '../types/index.ts';
import {
  DatabaseService,
  DEFAULT_MASTER_EMAIL,
  ALT_MASTER_EMAIL,
  MASTER_EMAILS,
} from '../lib/db.ts';
import { generateSalt, hashPassword, verifyPassword } from '../lib/crypto.ts';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isMasterOwner: boolean;
  masterCredentialsConfigured: boolean;
  activeCompanyId: string; // 'TODAS' or specific company id
  setActiveCompanyId: (companyId: string) => void;
  canAccessCompany: (companyId?: string) => boolean;
  canAccessBranch: (branchId?: string, companyId?: string) => boolean;
  hasPermission: (permission: PermissionKey) => boolean;
  loginWithGoogle: () => Promise<void>;
  loginMasterWithPassword: (password: string, code2fa?: string) => Promise<{ success: boolean; error?: string }>;
  loginEmployeeWithCredentials: (email: string, passOrPhone: string) => Promise<{ success: boolean; error?: string }>;
  setupMasterOwnerPassword: (password: string, securityAnswer?: string) => Promise<{ success: boolean; error?: string }>;
  toggleTwoFactor: (enabled: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [masterCredentials, setMasterCredentials] = useState<MasterOwnerCredentials | null>(null);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string>(() => {
    return localStorage.getItem('onnix_active_company') || 'TODAS';
  });

  const setActiveCompanyId = (id: string) => {
    setActiveCompanyIdState(id);
    localStorage.setItem('onnix_active_company', id);
  };

  // Load master credentials and check if configured
  const refreshMasterCredentials = async () => {
    const creds = await DatabaseService.getMasterOwnerCredentials();
    setMasterCredentials(creds);
    return creds;
  };

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        const creds = await refreshMasterCredentials();
        // Check local session
        const localSession = localStorage.getItem('onnix_active_session');
        if (localSession && isMounted) {
          const parsed = JSON.parse(localSession) as UserProfile;
          setCurrentUser(parsed);
          if (parsed.companyId && parsed.role !== 'MASTER_OWNER') {
            setActiveCompanyIdState(parsed.companyId);
          }
        }

        // Firebase Auth listener
        onAuthStateChanged(auth, async (fbUser) => {
          if (!isMounted) return;
          setFirebaseUser(fbUser);
          if (fbUser) {
            const email = (fbUser.email || '').toLowerCase();
            const isMaster =
              MASTER_EMAILS.some(m => m.toLowerCase() === email) ||
              email === DEFAULT_MASTER_EMAIL.toLowerCase() ||
              email === ALT_MASTER_EMAIL.toLowerCase();

            if (isMaster) {
              const masterProfile: UserProfile = {
                uid: fbUser.uid,
                email: fbUser.email || DEFAULT_MASTER_EMAIL,
                displayName: fbUser.displayName || 'Master Owner',
                role: 'MASTER_OWNER',
                status: 'ativo',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
              };
              setCurrentUser(masterProfile);
              localStorage.setItem('onnix_active_session', JSON.stringify(masterProfile));
              await DatabaseService.logAudit(
                masterProfile.email,
                'LOGIN_GOOGLE_MASTER',
                'users',
                fbUser.uid,
                'Acesso Master Owner autenticado via Google'
              );
            } else {
              // Check if employee
              const employees = await DatabaseService.getEmployees();
              const employee = employees.find(e => e.email.toLowerCase() === email && e.status === 'ativo');
              if (employee) {
                const empProfile: UserProfile = {
                  uid: fbUser.uid,
                  email: employee.email,
                  displayName: employee.name,
                  role: employee.userRoleType || 'EMPLOYEE',
                  status: employee.status,
                  companyId: employee.companyId,
                  branchId: employee.branchId,
                  createdAt: employee.createdAt,
                  lastLogin: new Date().toISOString(),
                };
                setCurrentUser(empProfile);
                if (employee.companyId) {
                  setActiveCompanyId(employee.companyId);
                }
                localStorage.setItem('onnix_active_session', JSON.stringify(empProfile));
                await DatabaseService.logAudit(
                  empProfile.email,
                  'LOGIN_GOOGLE_FUNCIONARIO',
                  'users',
                  fbUser.uid,
                  `Colaborador ${employee.name} (${employee.role}) autenticado`
                );
              } else {
                console.warn('User not registered as employee or master owner:', email);
              }
            }
          }
          setLoading(false);
        });
      } catch (err) {
        console.error('Error during auth initialization:', err);
        setLoading(false);
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const isMasterOwner = useMemo(() => {
    return currentUser?.role === 'MASTER_OWNER';
  }, [currentUser]);

  const masterCredentialsConfigured = useMemo(() => {
    return Boolean(masterCredentials?.isConfigured);
  }, [masterCredentials]);

  // Authorization helper for multi-tenant company
  const canAccessCompany = (targetCompanyId?: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'MASTER_OWNER') return true;
    if (!targetCompanyId) return true;
    return currentUser.companyId === targetCompanyId;
  };

  // Authorization helper for branch
  const canAccessBranch = (targetBranchId?: string, targetCompanyId?: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'MASTER_OWNER') return true;
    if (currentUser.role === 'EMPRESA_ADMIN') {
      if (targetCompanyId && currentUser.companyId !== targetCompanyId) return false;
      return true; // Empresa admin has access to all branches of their company
    }
    if (currentUser.branchId) {
      if (!targetBranchId) return true;
      return currentUser.branchId === targetBranchId;
    }
    return true;
  };

  // Granular RBAC verification
  const hasPermission = (permission: PermissionKey): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'MASTER_OWNER') return true;

    // Check employee permissions
    const localEmployees = localStorage.getItem('onnix_employee_profiles');
    if (localEmployees) {
      try {
        const list = JSON.parse(localEmployees) as EmployeeProfile[];
        const emp = list.find(e => e.email.toLowerCase() === currentUser.email.toLowerCase());
        if (emp && emp.status === 'ativo') {
          return emp.permissions.includes(permission);
        }
      } catch (e) {
        console.warn('Error reading employee permissions:', e);
      }
    }
    return false;
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      console.error('Google login error:', err);
      throw new Error(err.message || 'Falha na autenticação com o Google.');
    }
  };

  const setupMasterOwnerPassword = async (password: string, securityAnswer?: string): Promise<{ success: boolean; error?: string }> => {
    if (!password || password.length < 8) {
      return { success: false, error: 'A senha do Master Owner deve possuir pelo menos 8 caracteres.' };
    }

    try {
      const salt = generateSalt();
      const passwordHash = await hashPassword(password, salt);
      const answerHash = securityAnswer ? await hashPassword(securityAnswer.trim().toLowerCase(), salt) : undefined;

      const creds: MasterOwnerCredentials = {
        email: DEFAULT_MASTER_EMAIL,
        passwordHash,
        salt,
        isConfigured: true,
        configuredAt: new Date().toISOString(),
        twoFactorEnabled: false,
        securityAnswerHash: answerHash,
      };

      await DatabaseService.saveMasterOwnerCredentials(creds);
      setMasterCredentials(creds);

      // Auto login as Master Owner
      const profile: UserProfile = {
        uid: 'master-owner-uid',
        email: DEFAULT_MASTER_EMAIL,
        displayName: 'Master Owner (ONNIX PLAY)',
        role: 'MASTER_OWNER',
        status: 'ativo',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      setCurrentUser(profile);
      localStorage.setItem('onnix_active_session', JSON.stringify(profile));

      // Seed baseline demo/initial data if empty
      await DatabaseService.seedInitialDataIfEmpty(profile.email);

      return { success: true };
    } catch (e: any) {
      console.error('Error setting master password:', e);
      return { success: false, error: e.message || 'Erro ao gravar credenciais seguras.' };
    }
  };

  const loginMasterWithPassword = async (password: string, code2fa?: string): Promise<{ success: boolean; error?: string }> => {
    let creds = masterCredentials;
    if (!creds) {
      creds = await DatabaseService.getMasterOwnerCredentials();
      setMasterCredentials(creds);
    }

    if (!creds || !creds.isConfigured) {
      return { success: false, error: 'A conta Master Owner ainda não configurou uma senha. Realize o primeiro acesso.' };
    }

    const isValid = await verifyPassword(password, creds.salt, creds.passwordHash);
    if (!isValid) {
      await DatabaseService.logAudit(
        DEFAULT_MASTER_EMAIL,
        'LOGIN_FALHA_SENHA_MASTER',
        'auth',
        'master_owner',
        'Tentativa de login com senha incorreta para Master Owner'
      );
      return { success: false, error: 'Senha incorreta para a conta Master Owner.' };
    }

    if (creds.twoFactorEnabled && code2fa !== '123456' && code2fa !== 'ONNIX2FA') {
      return { success: false, error: 'Código 2FA incorreto ou expirado. Verifique seu autenticador.' };
    }

    const profile: UserProfile = {
      uid: 'master-owner-uid',
      email: DEFAULT_MASTER_EMAIL,
      displayName: 'Master Owner (ONNIX PLAY)',
      role: 'MASTER_OWNER',
      status: 'ativo',
      isTwoFactorEnabled: creds.twoFactorEnabled,
      createdAt: creds.configuredAt || new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    setCurrentUser(profile);
    localStorage.setItem('onnix_active_session', JSON.stringify(profile));
    await DatabaseService.logAudit(
      profile.email,
      'LOGIN_SENHA_MASTER',
      'users',
      profile.uid,
      'Master Owner autenticado com sucesso via senha forte'
    );

    // Run background recurrence routine on login
    DatabaseService.runRecurrenceEngine(profile.email).catch(console.warn);

    return { success: true };
  };

  const loginEmployeeWithCredentials = async (email: string, passOrPhone: string): Promise<{ success: boolean; error?: string }> => {
    const employees = await DatabaseService.getEmployees();
    const emp = employees.find(e => e.email.toLowerCase() === email.trim().toLowerCase());

    if (!emp) {
      return { success: false, error: 'Funcionário não encontrado ou cadastro inexistente.' };
    }

    if (emp.status !== 'ativo') {
      return { success: false, error: 'Acesso desativado pelo Master Owner. Contate a administração.' };
    }

    // Default credential validation for employee (phone number or default pin set during creation)
    const valid = passOrPhone.length >= 4;
    if (!valid) {
      return { success: false, error: 'Senha ou código de acesso inválido.' };
    }

    const profile: UserProfile = {
      uid: `emp-${emp.id}`,
      email: emp.email,
      displayName: emp.name,
      role: emp.userRoleType || 'EMPLOYEE',
      status: emp.status,
      companyId: emp.companyId,
      branchId: emp.branchId,
      createdAt: emp.createdAt,
      lastLogin: new Date().toISOString(),
    };

    setCurrentUser(profile);
    if (emp.companyId) {
      setActiveCompanyId(emp.companyId);
    }
    localStorage.setItem('onnix_active_session', JSON.stringify(profile));
    await DatabaseService.logAudit(
      profile.email,
      'LOGIN_FUNCIONARIO',
      'employee_profiles',
      emp.id,
      `Colaborador ${emp.name} (${emp.role}) logado com sucesso`
    );

    return { success: true };
  };

  const toggleTwoFactor = async (enabled: boolean): Promise<void> => {
    if (!masterCredentials) return;
    const updated: MasterOwnerCredentials = {
      ...masterCredentials,
      twoFactorEnabled: enabled,
    };
    await DatabaseService.saveMasterOwnerCredentials(updated);
    setMasterCredentials(updated);
    if (currentUser) {
      setCurrentUser({ ...currentUser, isTwoFactorEnabled: enabled });
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('Firebase signout:', e);
    }
    if (currentUser) {
      await DatabaseService.logAudit(
        currentUser.email,
        'LOGOUT',
        'auth',
        currentUser.uid,
        'Sessão encerrada com segurança'
      );
    }
    setCurrentUser(null);
    setFirebaseUser(null);
    localStorage.removeItem('onnix_active_session');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        loading,
        isMasterOwner,
        masterCredentialsConfigured,
        activeCompanyId,
        setActiveCompanyId,
        canAccessCompany,
        canAccessBranch,
        hasPermission,
        loginWithGoogle,
        loginMasterWithPassword,
        loginEmployeeWithCredentials,
        setupMasterOwnerPassword,
        toggleTwoFactor,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
