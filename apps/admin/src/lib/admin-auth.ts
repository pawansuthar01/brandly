export type AdminRole = 'Owner' | 'Moderator';

export interface AdminSession {
  email: string;
  role: AdminRole;
  accessToken?: string;
  expiresAt?: number;
}

export const ADMIN_SESSION_KEY = 'brandly-admin-session';

// Both admin roles can access every operational page. The two sensitive
// permissions are guarded at their actions: inviting admins and suspending users
// remain Owner-only in the UI and service workflow.
export const ownerOnlySections = new Set<string>();

export function normalizeRole(value: unknown): AdminRole | null {
  if (value === 'Owner' || value === 'Moderator') return value;
  return null;
}

export function canAccessSection(role: AdminRole, section: string) {
  return role === 'Owner' || !ownerOnlySections.has(section);
}

export function readAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<AdminSession>;
    const role = normalizeRole(parsed.role);
    if (!parsed.email || !role || !parsed.accessToken) {
      // Older demo sessions used a generic "admin" role.  Never silently
      // upgrade those sessions to Owner access.
      window.localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
    if (typeof parsed.expiresAt === 'number' && parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
    return { email: parsed.email, role, accessToken: parsed.accessToken, ...(typeof parsed.expiresAt === 'number' ? { expiresAt: parsed.expiresAt } : {}) };
  } catch {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }
}

export function saveAdminSession(session: AdminSession) {
  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}
