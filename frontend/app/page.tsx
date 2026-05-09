'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, KeyRound, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { login } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { setAdminSession, setTenantSession } from '@/lib/session';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await login(password);

      if (result.type === 'admin') {
        setAdminSession();
        router.push('/admin/');
      } else if (result.type === 'tenant' && result.tenant) {
        setTenantSession(result.tenant);
        router.push(`/tenant/${result.tenant.id}/`);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/20 mb-4"
          >
            <Building2 className="w-10 h-10 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-bold">
            Hous<span className="text-primary">Billing</span>
          </h1>
          <p className="text-muted-foreground mt-2">Smart Rental Management</p>
        </div>

        {/* Login Card */}
        <Card className="card-premium">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Enter Password
            </CardTitle>
            <CardDescription>
              Enter your password to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-center text-lg tracking-widest"
                autoFocus
              />

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Admin? Use your admin password.<br />
              Tenant? Use the password given by your landlord.
            </p>

            <div className="mt-4 pt-4 border-t border-border/50 text-center">
              <Button variant="link" className="text-xs" onClick={() => router.push('/bill-status/')}>
                Public Billing Overview →
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Powered by AI Meter Reading 🤖
        </p>
      </motion.div>
    </main>
  );
}
