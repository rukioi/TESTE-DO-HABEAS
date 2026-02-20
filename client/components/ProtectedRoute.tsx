import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredAccountTypes?: ('SIMPLES' | 'COMPOSTA' | 'GERENCIAL')[];
  requiredActivePlan?: boolean;
}

export function ProtectedRoute({ children, requiredAccountTypes, requiredActivePlan }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, subscriptionActive } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredActivePlan && !subscriptionActive) {
    return <Navigate to="/configuracoes?aviso=plano-requerido" replace />;
  }

  // Check account type access if required
  if (requiredAccountTypes && user) {
    const hasAccess = requiredAccountTypes.includes(user.accountType);
    if (!hasAccess) {
      return <Navigate to="/acesso-negado" replace />;
    }
  }

  return <>{children}</>;
}
