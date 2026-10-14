'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveAdminSession } from '@/lib/admin-auth';
import { loginAdmin } from '@/services/adminApi.service';
import styles from './login.module.css';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const account = await loginAdmin(email, password);
      saveAdminSession({ email: account.email, role: account.role, accessToken: account.accessToken, expiresAt: Date.now() + account.expiresIn * 1000 });
      router.replace('/admin');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Admin sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return <main className={styles.page}>
    <section className={styles.panel}>
      <div className={styles.brandLine}><span className={styles.logo}>B</span><span>brandly</span></div>
      <div className={styles.intro}>
        <div className={styles.kicker}><ShieldCheck size={14} /> Secure admin access</div>
        <h1>Keep the marketplace moving.</h1>
        <p>Review trust signals, shape discovery, and keep every collaboration clear from one focused workspace.</p>
      </div>
      <div className={styles.points}>
        <span><CheckCircle2 size={16} /> Account and campaign operations</span>
        <span><CheckCircle2 size={16} /> Database-backed marketplace data</span>
        <span><CheckCircle2 size={16} /> Responsive by default</span>
      </div>
      <div className={styles.footer}>Brandly admin · Database-backed operations</div>
    </section>
    <section className={styles.formPanel}>
      <form onSubmit={submit} className={styles.form}>
        <div className={styles.formIcon}><LockKeyhole size={20} /></div>
        <div><p className={styles.formEyebrow}>Welcome back</p><h2>Sign in to admin</h2><p className={styles.helper}>Sign in to manage live configuration stored by the API.</p></div>
        <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
        {error && <div className={styles.error} role="alert">{error}</div>}
        <button className={styles.submit} type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Continue'} {!loading && <ArrowRight size={17} />}</button>
      </form>
    </section>
  </main>;
}
