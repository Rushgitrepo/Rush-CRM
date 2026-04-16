import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, ChevronRight, LayoutGrid, Eye, EyeOff } from 'lucide-react';
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
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirm, setShowSignUpConfirm] = useState(false);
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

      const { error: authError } = await signUp(email, password, fullName);

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-100 selection:bg-slate-900 selection:text-white">
      {/* Left Pane: Brand & Visual */}
      <div className="hidden lg:flex relative overflow-hidden bg-slate-950 border-r border-slate-800">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2000"
            alt="Office background"
            className="w-full h-full object-cover opacity-15 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-950/80 to-slate-900/40" />
        </div>

        <div className="relative z-10 p-14 flex flex-col justify-between w-full h-full">
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="w-11 h-11 bg-white flex items-center justify-center rounded-lg shadow-sm">
                <LayoutGrid className="w-6 h-6 text-slate-950" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-white">Rush Management System</span>
            </div>

            <h2 className="text-4xl xl:text-5xl font-semibold text-white leading-[1.1] mb-6 tracking-tight max-w-md">
              Workflows that stay out of the way.
            </h2>

            <p className="text-base text-slate-300 max-w-md mb-10 leading-relaxed">
              A straightforward space to manage leads, calls, follow-ups, and the rest of your day.
            </p>

            <div className="space-y-5">
              {[
                { title: 'One place for leads', desc: 'Keep contact details, notes, and follow-up work together.' },
                { title: 'Useful over flashy', desc: 'Fast forms and clear views that get out of the way.' },
                { title: 'Built for teams', desc: 'Shared data, accountability, and simple handoffs.' }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4 items-start group">
                  <div className="mt-1 w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center group-hover:border-slate-400 transition-colors">
                    <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100 mb-1">{item.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Form */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-8 lg:p-12 bg-slate-100">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 lg:hidden text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 bg-slate-900 flex items-center justify-center rounded-lg">
                <LayoutGrid className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-slate-900">Rush RMS</span>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-3xl font-semibold tracking-tight text-slate-900 mb-2">
              {activeTab === 'signin' ? 'RMS Login' : 'Create Account'}
            </h3>
            <p className="text-sm text-slate-500">
              Sign in to your account or create a new one.
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-700 font-medium text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="mb-6 border-green-200 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 font-medium text-sm">{successMessage}</AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex w-full bg-white border border-slate-200 rounded-lg h-auto p-1 mb-8 overflow-hidden shadow-sm">
              <TabsTrigger
                value="signin"
                className="flex-1 font-medium text-sm py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white rounded-md transition-all"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="flex-1 font-medium text-sm py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white rounded-md transition-all"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-6">
              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-sm font-medium text-slate-700 pl-1">
                    Email Address
                  </Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    required
                    disabled={isLoading}
                    className="h-11 border-slate-200 bg-white text-black text-sm rounded-lg focus:ring-2 focus:ring-slate-900/10 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between pl-1">
                    <Label htmlFor="signin-password" className="text-sm font-medium text-slate-700">
                      Password
                    </Label>
                    <Link to="/forgot-password" size="sm" className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors">
                      Forgot Password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      name="password"
                      type={showSignInPassword ? "text" : "password"}
                      required
                      disabled={isLoading}
                      className="h-11 border-slate-200 bg-white text-black text-sm rounded-lg focus:ring-2 focus:ring-slate-900/10 transition-all pr-12"
                    />
                    <a
                      type="button"
                      className="absolute right-0 top-0 h-11 w-11 text-black-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
                      onClick={() => setShowSignInPassword(!showSignInPassword)}
                    >
                      {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </a>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-primary hover:bg-slate-800 text-white font-medium rounded-lg transition-all duration-300 active:scale-[0.99] shadow-sm"
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
                  <Label htmlFor="signup-name" className="text-sm font-medium text-slate-700 pl-1">
                    Complete Name
                  </Label>
                  <Input
                    id="signup-name"
                    name="fullName"
                    type="text"
                    required
                    disabled={isLoading}
                    className="h-11 border-slate-200 bg-white text-sm rounded-lg focus:ring-2 focus:ring-slate-900/10 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-medium text-slate-700 pl-1">
                    System Email
                  </Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    required
                    disabled={isLoading}
                    className="h-11 border-slate-200 bg-white text-sm rounded-lg focus:ring-2 focus:ring-slate-900/10 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium text-slate-700 pl-1">
                    Secure Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      name="password"
                      type={showSignUpPassword ? "text" : "password"}
                      required
                      disabled={isLoading}
                      className="h-11 border-slate-200 bg-white text-sm rounded-lg focus:ring-2 focus:ring-slate-900/10 transition-all pr-12"
                    />
                    <a
                      type="button"
                      className="absolute right-0 top-0 h-11 w-11 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
                      onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                    >
                      {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </a>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm" className="text-sm font-medium text-slate-700 pl-1">
                    Verify Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="signup-confirm"
                      name="confirmPassword"
                      type={showSignUpConfirm ? "text" : "password"}
                      required
                      disabled={isLoading}
                      className="h-11 border-slate-200 bg-white text-sm rounded-lg focus:ring-2 focus:ring-slate-900/10 transition-all pr-12"
                    />
                    <a
                      type="button"
                      className="absolute right-0 top-0 h-11 w-11 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
                      onClick={() => setShowSignUpConfirm(!showSignUpConfirm)}
                    >
                      {showSignUpConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </a>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-all duration-300 active:scale-[0.99] shadow-sm"
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
