import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, LayoutGrid, ChevronRight } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setIsLoading(true);
    try {
      await (authApi as any).resetPassword({ token, password });
      setSuccess(true);
      setTimeout(() => navigate('/auth'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 p-6 selection:bg-slate-900 selection:text-white font-sans">
        <div className="w-full max-w-[400px] text-center space-y-8">
           <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-slate-900 dark:bg-white flex items-center justify-center rounded-xl">
              <LayoutGrid className="w-5 h-5 text-white dark:text-slate-900" />
            </div>
            <span className="text-2xl font-bold tracking-tighter text-slate-900 dark:text-white uppercase">Rush RMS</span>
          </div>

          <div className="p-10 border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20 rounded-3xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-extralight tracking-tight mb-2 text-slate-900 dark:text-white uppercase">Invalid Request</h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed mb-8">System token has expired or is invalid</p>
            <Button className="w-full h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold uppercase tracking-[0.2em] text-xs rounded-xl transition-all" onClick={() => navigate('/auth')}>
              Return to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white dark:bg-slate-950 font-sans selection:bg-slate-900 selection:text-white">
      {/* Left Pane: Brand & Visual */}
      <div className="hidden lg:flex relative overflow-hidden bg-slate-900 border-r border-slate-800">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1554224155-16974fa9f2c5?auto=format&fit=crop&q=80&w=2000" 
            alt="Security background" 
            className="w-full h-full object-cover opacity-20 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/40 to-transparent" />
        </div>
        
        <div className="relative z-10 p-16 flex flex-col justify-between w-full h-full">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-white flex items-center justify-center rounded-xl shadow-2xl">
                <LayoutGrid className="w-6 h-6 text-slate-950" />
              </div>
              <span className="text-2xl font-bold tracking-tighter text-white uppercase">Rush RMS</span>
            </div>
            
            <h2 className="text-6xl font-extralight text-white leading-[1.1] mb-8 tracking-tighter">
              Password <br />
              <span className="text-slate-400">Modification.</span>
            </h2>
            
            <div className="space-y-6">
              {[
                { title: 'Security Protocol', desc: 'Securely update your access credentials.' },
                { title: 'Identity Verified', desc: 'Authorized session for password reset.' },
                { title: 'System Compliance', desc: 'Adhering to enterprise security standards.' }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4 items-start group">
                  <div className="mt-1 w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center group-hover:border-white transition-colors">
                    <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200 uppercase tracking-widest mb-1">{item.title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">
            Rush Resource Management System v2.0
          </div>
        </div>
      </div>

      {/* Right Pane: Form */}
      <div className="flex flex-col justify-center items-center p-8 lg:p-24 bg-white dark:bg-slate-950">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden text-center">
             <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 bg-slate-900 dark:bg-white flex items-center justify-center rounded-lg">
                <LayoutGrid className="w-4 h-4 text-white dark:text-slate-900" />
              </div>
              <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white uppercase">Rush RMS</span>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-3xl font-extralight tracking-tighter text-slate-900 dark:text-white mb-2">
              New Password
            </h3>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">
              {success 
                ? "Password updated successfully" 
                : "Initialize your new system credentials"}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6 border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 rounded-xl">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-700 dark:text-red-400 font-medium text-xs uppercase tracking-wider">{error}</AlertDescription>
            </Alert>
          )}

          {success ? (
            <div className="space-y-6">
              <div className="p-8 border border-green-100 dark:border-green-900/30 bg-green-50 dark:bg-green-950/20 rounded-3xl text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase mb-2">Updated</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Master key synchronized. Redirecting...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password" className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest pl-1">
                  New Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm rounded-xl focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest pl-1">
                  Verify Password
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm rounded-xl focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-primary hover:bg-primary/80 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold uppercase tracking-[0.2em] text-xs rounded-xl transition-all duration-300 shadow-lg shadow-primary/20 active:scale-[0.98]"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          )}

          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-900">
             <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
              Protected by Enterprise Shield <br />
              <a href="#" className="text-primary hover:underline">Compliance Protocol</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
