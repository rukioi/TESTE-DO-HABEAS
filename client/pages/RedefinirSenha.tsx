import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Lock, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string().min(1, 'Confirme a nova senha'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: [ 'confirmPassword' ],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export function RedefinirSenha() {
  const [ searchParams ] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [ isValidating, setIsValidating ] = useState(!!token);
  const [ tokenValid, setTokenValid ] = useState(false);
  const [ successMessage, setSuccessMessage ] = useState('');
  const [ errorMessage, setErrorMessage ] = useState('');
  const [ showPassword, setShowPassword ] = useState(false);
  const [ showConfirmPassword, setShowConfirmPassword ] = useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!cancelled) {
          setTokenValid(res.ok && data.valid === true);
        }
      } catch {
        if (!cancelled) setTokenValid(false);
      } finally {
        if (!cancelled) setIsValidating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ token ]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setErrorMessage('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: data.newPassword,
          confirmPassword: data.confirmPassword,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        setSuccessMessage(result.message || 'Senha alterada com sucesso. Redirecionando para o login...');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      } else {
        setErrorMessage(result.error || 'Não foi possível redefinir a senha. Tente novamente.');
      }
    } catch {
      setErrorMessage('Erro de conexão. Tente novamente.');
    }
  };

  const isInvalidOrExpired = !token || (!isValidating && !tokenValid);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 lg:p-8 font-sans">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Left: branding (same as Login) */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="hidden lg:flex flex-col text-white space-y-8 pr-12"
        >
          <div className="flex items-center gap-4 mb-6">
            <img
              src="/logo_perfeita.png"
              alt="Habeas Desk Logo"
              className="object-contain h-14"
            />
            <span className="text-3xl font-light tracking-tight text-white">HABEAS DESK</span>
          </div>
          <div className="space-y-6">
            <h1 className="text-5xl xl:text-6xl font-light leading-tight tracking-tight">
              Redefina sua senha de forma segura.
            </h1>
            <p className="text-xl text-white/80">
              Use o link que enviamos ao seu email para criar uma nova senha e acessar sua conta.
            </p>
          </div>
        </motion.div>

        {/* Right: card */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md mx-auto"
        >
          <Card className="border border-gray-200 shadow-xl rounded-2xl bg-white overflow-hidden">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-semibold text-[#1B223C]">
                Redefinir senha
              </CardTitle>
              <CardDescription className="text-gray-500">
                Informe sua nova senha abaixo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isValidating && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#e19a00] mb-4" />
                  <p>Validando link...</p>
                </div>
              )}

              {!isValidating && isInvalidOrExpired && (
                <div className="space-y-4">
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Link inválido ou expirado. Solicite uma nova recuperação de senha na tela de login.
                    </AlertDescription>
                  </Alert>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-sm text-[#e19a00] hover:text-[#c78b00] font-medium"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para o Login
                  </Link>
                </div>
              )}

              {!isValidating && tokenValid && !successMessage && (
                <motion.form
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-5"
                >
                  {errorMessage && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-gray-700 font-medium">Nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 8 caracteres"
                        className="h-12 pl-10 pr-10 bg-gray-50 border-gray-200 focus:border-[#e19a00] focus:ring-[#e19a00] rounded-lg"
                        {...form.register('newPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {form.formState.errors.newPassword && (
                      <p className="text-sm text-red-600">{form.formState.errors.newPassword.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-gray-700 font-medium">Confirmar nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Repita a nova senha"
                        className="h-12 pl-10 pr-10 bg-gray-50 border-gray-200 focus:border-[#e19a00] focus:ring-[#e19a00] rounded-lg"
                        {...form.register('confirmPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {form.formState.errors.confirmPassword && (
                      <p className="text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#e19a00] hover:bg-[#c78b00] text-white font-medium uppercase tracking-wider rounded-lg shadow-md transition-all"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? 'Salvando...' : 'Redefinir senha'}
                  </Button>

                  <div className="text-center pt-2">
                    <Link
                      to="/login"
                      className="text-sm text-gray-600 hover:text-[#e19a00] flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar para o Login
                    </Link>
                  </div>
                </motion.form>
              )}

              {successMessage && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {successMessage}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="text-center mt-8 text-white/40 text-sm">
            <p>© 2026 HABEAS DESK. Todos os direitos reservados.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
