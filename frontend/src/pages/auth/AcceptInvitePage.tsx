
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { ShieldCheck, Lock, Loader2, CheckCircle2 } from 'lucide-react';

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [userInfo, setUserInfo] = React.useState<any>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    async function verify() {
      if (!token) {
        setVerifying(false);
        return;
      }
      try {
        const data = await authApi.verifyInvite(token);
        setUserInfo(data);
      } catch (err) {
        toast.error("Invalid or expired invitation link.");
      } finally {
        setVerifying(false);
      }
    }
    verify();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
        toast.error("Invalid invitation link. Token is missing.");
        return;
    }

    if (password.length < 8) {
        toast.error("Password must be at least 8 characters long.");
        return;
    }

    if (password !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
    }

    setLoading(true);
    try {
      await authApi.acceptInvite({ token, password });
      toast.success("Welcome! Your account is now active.");
      navigate('/auth');
    } catch (error: any) {
      toast.error(error.message || "Failed to accept invitation. The link may be expired.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
            <Card className="w-full max-w-md border-none shadow-2xl animate-in zoom-in duration-300">
                <CardHeader className="text-center pb-8">
                    <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Account Activated!</CardTitle>
                    <CardDescription>
                        Your password has been set successfully. You will be redirected to the login page shortly.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pb-8 flex justify-center">
                    <Button onClick={() => navigate('/auth')} className="bg-emerald-600 hover:bg-emerald-700">
                        Go to Login Now
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (verifying) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!token || !userInfo) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md border-destructive/20 shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-destructive">Invalid Invitation</CardTitle>
                    <CardDescription>This invitation link is invalid or has reached its expiration.</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button className="w-full" variant="outline" onClick={() => navigate('/auth')}>Back to Home</Button>
                </CardFooter>
            </Card>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden">
        <div className="h-2 bg-primary w-full" />
        <CardHeader className="text-center space-y-1 pb-8 pt-8">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center rotate-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome, {userInfo.full_name}!</CardTitle>
          <CardDescription>
            Setting up account for <span className="text-foreground font-semibold">{userInfo.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password"
                  type="password" 
                  placeholder="Min 8 characters" 
                  className="pl-10"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="confirmPassword"
                  type="password" 
                  placeholder="Re-type password" 
                  className="pl-10"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <Button 
                type="submit" 
                className="w-full h-11 bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20" 
                disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Complete Account Setup
            </Button>
          </form>
        </CardContent>
        <CardFooter className="bg-muted/50 py-4 flex justify-center border-t border-border/50">
            <p className="text-xs text-muted-foreground italic">Rush CRM secure onboarding process</p>
        </CardFooter>
      </Card>
    </div>
  );
}
