import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Mail, Lock, User, Key, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string(),
  key: z.string().min(10, 'Chave de registro é obrigatória'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: [ "confirmPassword" ],
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function Login() {
  const [ activeTab, setActiveTab ] = useState('login');
  const [ showPassword, setShowPassword ] = useState(false);
  const [ showConfirmPassword, setShowConfirmPassword ] = useState(false);
  const [ isLoading, setIsLoading ] = useState(false);
  const [ successMessage, setSuccessMessage ] = useState('');
  const [ errorMessage, setErrorMessage ] = useState('');

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      key: '',
    },
  });

  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      console.log('Attempting login with:', data.email);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        localStorage.setItem('access_token', result.tokens.accessToken);
        localStorage.setItem('refresh_token', result.tokens.refreshToken);
        setSuccessMessage('Login realizado com sucesso! Redirecionando...');
        window.location.href = '/';
      } else {
        let errorMessage = result.error || 'Email ou senha incorretos';
        const errorType = result.errorType;

        if (errorMessage === 'Invalid credentials') {
          errorMessage = 'Credenciais Inválidas';
        }

        if (errorType === 'Plano expirado') {
          setErrorMessage('🔒 Plano expirado! Sua conta não está mais ativa. Entre em contato com o administrador para renovar.');
        } else {
          setErrorMessage(errorMessage);
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = error.response?.data?.message || error.message || 'Failed to login';
      const errorType = error.response?.data?.error;

      if (errorMessage === 'Invalid credentials') {
        errorMessage = 'Credenciais Inválidas';
      }

      if (errorType === 'Plano expirado') {
        setErrorMessage('🔒 Plano expirado! Sua conta não está mais ativa. Entre em contato com o administrador para renovar.');
      } else {
        setErrorMessage(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          key: data.key,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage(
          `Conta criada com sucesso! Você foi registrado como conta ${result.user.accountType}. Faça login para continuar.`
        );
        setActiveTab('login');
        registerForm.reset();
      } else {
        setErrorMessage(result.error || 'Erro ao criar conta');
      }
    } catch (error) {
      console.error('Register error:', error);
      setErrorMessage('Erro ao conectar com servidor. Verifique sua conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 503) {
        setErrorMessage(result.error || 'Serviço de email temporariamente indisponível. Tente mais tarde.');
        return;
      }
      if (response.ok && result.sent === true) {
        setSuccessMessage('Email de recuperação enviado! Verifique sua caixa de entrada.');
        forgotPasswordForm.reset();
        return;
      }
      setErrorMessage(result.message || 'Se o email estiver cadastrado, você receberá um link. Verifique sua caixa de entrada e o spam.');
    } catch (error) {
      setErrorMessage('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 lg:p-8 font-sans">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
        
        {/* Left Column: Branding */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
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
              Todas as ferramentas que você precisa. <br />
              Você encontra na <span className="text-[#e19a00] font-bold">Habeas Desk</span>.
            </h1>
            <p className="text-xl text-gray-300 font-light leading-relaxed max-w-lg">
              A maior e melhor ferramenta jurídica do Brasil. Otimize seu tempo e potencialize seus resultados.
            </p>
          </div>

          <div className="pt-6">
            <Button 
              className="bg-[#e19a00] hover:bg-[#c78b00] text-white font-medium py-7 px-10 rounded-xl text-lg uppercase tracking-wide shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1"
            >
              SAIBA MAIS
            </Button>
          </div>
        </motion.div>

        {/* Right Column: Login Card */}
        <div className="w-full max-w-lg mx-auto lg:ml-auto">
          {/* Mobile Logo (Visible only on small screens) */}
          <div className="lg:hidden flex justify-center mb-8">
             <img
              src="/logo_perfeita.png"
              alt="Habeas Desk Logo"
              className="object-contain h-16"
            />
          </div>

          <Card className="bg-white border-0 shadow-2xl rounded-xl overflow-hidden w-full">
            <CardHeader className="pt-8 pb-2 px-8">
              <CardTitle className="text-2xl font-bold text-gray-800">
                {activeTab === 'login' && 'Entrar como advogado'}
                {activeTab === 'register' && 'Criar nova conta'}
                {activeTab === 'forgot-password' && 'Recuperar senha'}
              </CardTitle>
              <CardDescription className="text-gray-500">
                {activeTab === 'login' && 'Acesse sua conta para continuar'}
                {activeTab === 'register' && 'Preencha os dados abaixo para se cadastrar'}
                {activeTab === 'forgot-password' && 'Informe seu email para receber o link'}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-8 pt-4 space-y-6">
              
              {/* Messages */}
              {successMessage && (
                <Alert className="border-[#e19a00]/30 bg-[#e19a00]/10">
                  <AlertDescription className="text-[#e19a00]">
                    {successMessage}
                  </AlertDescription>
                </Alert>
              )}

              {errorMessage && (
                <Alert variant="destructive" className={errorMessage.includes('Renove') ? 'border-orange-500 bg-orange-50' : ''}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className={errorMessage.includes('Renove') ? 'text-orange-800 font-medium' : ''}>
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              {/* LOGIN FORM */}
              {activeTab === 'login' && (
                <motion.form
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={loginForm.handleSubmit(handleLogin)}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-gray-700 font-medium">Digite seu e-mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      className="h-12 bg-gray-50 border-gray-200 focus:border-[#e19a00] focus:ring-[#e19a00] rounded-lg transition-all duration-200"
                      {...loginForm.register('email')}
                    />
                    {loginForm.formState.errors.email && (
                      <p className="text-sm text-red-600">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-gray-700 font-medium">Digite sua senha</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        className="h-12 bg-gray-50 border-gray-200 focus:border-[#e19a00] focus:ring-[#e19a00] rounded-lg pr-10 transition-all duration-200"
                        {...loginForm.register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-red-600">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-[#e19a00] hover:bg-[#c78b00] text-white font-medium uppercase tracking-wider text-base rounded-lg shadow-md transition-all mt-2" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Entrando...' : 'ENTRAR'}
                  </Button>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('forgot-password')}
                      className="text-sm text-gray-500 hover:text-[#e19a00] uppercase font-medium"
                    >
                      ESQUECI MINHA SENHA
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('register')}
                      className="text-sm text-[#1B223C] hover:text-[#e19a00] font-bold uppercase"
                    >
                      CADASTRE-SE AGORA
                    </button>
                  </div>
                </motion.form>
              )}

              {/* REGISTER FORM */}
              {activeTab === 'register' && (
                <motion.form
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={registerForm.handleSubmit(handleRegister)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nome Completo</Label>
                    <Input
                      id="register-name"
                      placeholder="Seu nome completo"
                      className="h-11 bg-gray-50 border-gray-200 focus:border-[#e19a00] focus:ring-[#e19a00] rounded-lg"
                      {...registerForm.register('name')}
                    />
                    {registerForm.formState.errors.name && (
                      <p className="text-sm text-red-600">{registerForm.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="seu@email.com"
                      className="h-11 bg-gray-50 border-gray-200 focus:border-[#e19a00] focus:ring-[#e19a00] rounded-lg"
                      {...registerForm.register('email')}
                    />
                    {registerForm.formState.errors.email && (
                      <p className="text-sm text-red-600">{registerForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registration-key">Chave de Registro</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="registration-key"
                        placeholder="Chave fornecida pelo admin"
                        className="h-11 pl-10 bg-gray-50 border-gray-200 focus:border-[#e19a00] focus:ring-[#e19a00] rounded-lg"
                        {...registerForm.register('key')}
                      />
                    </div>
                    {registerForm.formState.errors.key && (
                      <p className="text-sm text-red-600">{registerForm.formState.errors.key.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Senha</Label>
                      <div className="relative">
                        <Input
                          id="register-password"
                          type={showPassword ? 'text' : 'password'}
                          className="h-11 bg-gray-50 border-gray-200 focus:border-[#e19a00] focus:ring-[#e19a00] rounded-lg pr-8"
                          {...registerForm.register('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.password.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmar</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          className="h-11 bg-gray-50 border-gray-200 focus:border-[#e19a00] focus:ring-[#e19a00] rounded-lg pr-8"
                          {...registerForm.register('confirmPassword')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {registerForm.formState.errors.confirmPassword && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.confirmPassword.message}</p>
                      )}
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-[#e19a00] hover:bg-[#c78b00] text-white font-medium uppercase tracking-wider rounded-lg shadow-md transition-all mt-2" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Criando conta...' : 'CRIAR CONTA'}
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('login')}
                      className="text-sm text-gray-600 hover:text-[#e19a00] flex items-center justify-center gap-2 mx-auto"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar para Login
                    </button>
                  </div>
                </motion.form>
              )}

              {/* FORGOT PASSWORD FORM */}
              {activeTab === 'forgot-password' && (
                <motion.form
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={forgotPasswordForm.handleSubmit(handleForgotPassword)}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email Cadastrado</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="h-12 pl-10 bg-gray-50 border-gray-200 focus:border-[#e19a00] focus:ring-[#e19a00] rounded-lg"
                        {...forgotPasswordForm.register('email')}
                      />
                    </div>
                    {forgotPasswordForm.formState.errors.email && (
                      <p className="text-sm text-red-600">{forgotPasswordForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-[#e19a00] hover:bg-[#c78b00] text-white font-medium uppercase tracking-wider rounded-lg shadow-md transition-all" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Enviando...' : 'RECUPERAR SENHA'}
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('login')}
                      className="text-sm text-gray-600 hover:text-[#e19a00] flex items-center justify-center gap-2 mx-auto"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar para Login
                    </button>
                  </div>
                </motion.form>
              )}
            </CardContent>
          </Card>

          <div className="text-center mt-8 text-white/40 text-sm">
            <p>© 2026 HABEAS DESK. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
