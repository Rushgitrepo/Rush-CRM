import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {ArrowLeftCircle, Loader2, AlertCircle, CheckCircle2, ArrowLeft, LayoutGrid, ChevronRight } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    try {
      emailSchema.parse(email);

      const { error: apiError } = await authApi.forgotPassword(email);
      if (apiError) {
        setError((apiError as any).message || 'Failed to send reset email');
      } else {
        setSentTo(email);
        setEmailSent(true);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid bg-white dark:bg-slate-950 selection:bg-slate-900 selection:text-white">
      {/* Right Pane: Form */}
      
      <div className="flex flex-col justify-center items-center p-8 lg:p-24 bg-white dark:bg-slate-950">
        <div className="w-full max-w-[400px]">
          {/* Left Pane: Form */}
          <Link to="/auth" className="block">
            <ArrowLeftCircle className="h-8 w-8 text-slate-900 dark:text-white" />
          </Link>
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
              Forgot Password
            </h3>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">
              {emailSent
                ? "Recovery link dispatched successfully"
                : "Enter your email to receive a recovery link"}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6 border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 rounded-xl">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-700 dark:text-red-400 font-medium text-xs uppercase tracking-wider">{error}</AlertDescription>
            </Alert>
          )}

          {emailSent ? (
            <div className="space-y-6">
              <div className="p-6 border border-green-100 dark:border-green-900/30 bg-green-50 dark:bg-green-950/20 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-widest">Success</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  A secure link has been sent to <strong className="text-slate-900 dark:text-white">{sentTo}</strong>. Please check your inbox.
                </p>
              </div>

              <Link to="/auth" className="block">
                <Button variant="outline" className="w-full h-12 border-slate-200 dark:border-slate-800 rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-slate-50 dark:hover:bg-white/5 transition-all group">
                  <ArrowLeft className="mr-2 h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest pl-1">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  disabled={isLoading}
                  className="h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm rounded-xl focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all"
                />
              </div>

              <div className="space-y-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-primary hover:bg-primary/80 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold uppercase tracking-[0.2em] text-xs rounded-xl transition-all duration-300 shadow-lg shadow-primary/20 active:scale-[0.98]"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Send Recovery Link'
                  )}
                </Button>

                <Link to="/auth" className="block text-center mt-4">
                  <Button variant="ghost" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors uppercase tracking-widest h-auto py-0">
                    Cancel and Return
                  </Button>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
