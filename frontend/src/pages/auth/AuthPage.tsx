import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, ChevronRight, LayoutGrid } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, user } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('signin');

  // Redirect if already logged in
  if (user) {
    const from = (location.state as { from?: Location })?.from?.pathname || '/';
    navigate(from, { replace: true });
    return null;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      
      const { error: authError } = await signIn(email, password);
      
      if (authError) {
        setError(authError.message);
      } else {
        setSuccessMessage('Successfully authenticated. Redirecting...');
        setTimeout(() => navigate('/'), 1000);
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

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const fullName = formData.get('fullName') as string;

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }

      const { error: authError } = await signUp(email, password, {
        full_name: fullName,
      });

      if (authError) {
        setError(authError.message);
      } else {
        setSuccessMessage('Account created! Signing you in...');
        const { error: signInError } = await signIn(email, password);
        if (!signInError) {
          setTimeout(() => navigate('/'), 1000);
        }
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
    <div className="min-h-screen grid lg:grid-cols-2 bg-white dark:bg-slate-950 selection:bg-slate-900 selection:text-white">
      {/* Left Pane: Brand & Visual */}
      <div className="hidden lg:flex relative overflow-hidden bg-slate-900 border-r border-slate-800">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2000" 
            alt="Office background" 
            className="w-full h-full object-cover opacity-30 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/40 to-transparent" />
        </div>
        
        <div className="relative z-10 p-16 flex flex-col justify-between w-full h-full">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-white flex items-center justify-center rounded-xl shadow-2xl">
                <LayoutGrid className="w-6 h-6 text-slate-950" />
              </div>
              <span className="text-2xl font-bold tracking-tighter text-white uppercase">Rush Management System</span>
            </div>
            
            <h2 className="text-6xl font-extralight text-white leading-[1.1] mb-8 tracking-tighter">
              Next-Gen <br />
              <span className="text-slate-400">Resource Protocols.</span>
            </h2>
            
            <div className="space-y-6">
              {[
                { title: 'Unified Operations', desc: 'Centralized command for your entire enterprise.' },
                { title: 'Predictive Intelligence', desc: 'Real-time analytics for faster decision making.' },
                { title: 'Secure Infrastructure', desc: 'Military-grade encryption for all your data.' }
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

          <div className="mb-12">
            <h3 className="text-3xl font-extralight tracking-tighter text-slate-900 dark:text-white mb-2">
              {activeTab === 'signin' ? 'RMS Login' : 'Create Account'}
            </h3>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
             Sign in to your account or create a new one
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6 border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-700 dark:text-red-400 font-medium text-xs uppercase tracking-wider">{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="mb-6 border-green-100 dark:border-green-900/30 bg-green-50 dark:bg-green-950/20 rounded-xl">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-700 dark:text-green-400 font-medium text-xs uppercase tracking-wider">{successMessage}</AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex w-full bg-transparent border-b border-slate-100 dark:border-slate-800 rounded-none h-auto p-0 mb-8 overflow-hidden">
              <TabsTrigger 
                value="signin" 
                className="flex-1 font-bold uppercase tracking-[0.2em] text-[10px] py-4 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-slate-900 dark:data-[state=active]:border-white data-[state=active]:text-slate-900 dark:data-[state=active]:text-white rounded-none transition-all opacity-40 data-[state=active]:opacity-100"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger 
                value="signup" 
                className="flex-1 font-bold uppercase tracking-[0.2em] text-[10px] py-4 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-slate-900 dark:data-[state=active]:border-white data-[state=active]:text-slate-900 dark:data-[state=active]:text-white rounded-none transition-all opacity-40 data-[state=active]:opacity-100"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-6">
              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest pl-1">
                    Email Address
                  </Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    required
                    disabled={isLoading}
                    className="h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm rounded-xl focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between pl-1">
                    <Label htmlFor="signin-password" className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest">
                      Session Password
                    </Label>
                    <Link to="/forgot-password" size="sm" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors uppercase tracking-widest">
                      Forgot Password?
                    </Link>
                  </div>
                  <Input
                    id="signin-password"
                    name="password"
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
                  className="w-full h-12 bg-primary hover:bg-primary/80 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold uppercase tracking-[0.2em] text-xs rounded-xl transition-all duration-300 active:scale-[0.98] shadow-lg shadow-slate-900/10 dark:shadow-none"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Log In'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-6">
              <form onSubmit={handleSignUp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest pl-1">
                    Complete Name
                  </Label>
                  <Input
                    id="signup-name"
                    name="fullName"
                    type="text"
                    placeholder="Alex Rush"
                    required
                    disabled={isLoading}
                    className="h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm rounded-xl focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest pl-1">
                    System Email
                  </Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    required
                    disabled={isLoading}
                    className="h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm rounded-xl focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest pl-1">
                    Secure Password
                  </Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    className="h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm rounded-xl focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm" className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest pl-1">
                    Verify Password
                  </Label>
                  <Input
                    id="signup-confirm"
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
                  className="w-full h-12 bg-primary hover:bg-primary/80 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold uppercase tracking-[0.2em] text-xs rounded-xl transition-all duration-300 active:scale-[0.98] shadow-lg shadow-slate-900/10 dark:shadow-none"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
