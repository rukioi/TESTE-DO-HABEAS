import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Building,
  Key,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Database,
  Zap,
  BarChart3,
} from 'lucide-react';
import { useAdminApi, GlobalMetrics } from '../hooks/useAdminApi';
import { cn } from '@/lib/utils';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Paleta de cores do tema
const COLORS = {
  black: {
    primary: '#000000',
    secondary: '#1B223C',
  },
  orange: {
    primary: '#e19a00',
    hover: '#c78b00',
  },
  orangeAlt: {
    primary: '#F5A100',
    secondary: '#FFB733',
  },
  blue: {
    secondary: '#3B82F6',
  },
  cyan: {
    accent: '#06B6D4',
  },
  neutral: {
    dark: '#2A2F45',
    medium: '#6B7280',
    light: '#E5E7EB',
  },
};

// Cores para gráficos
const CHART_COLORS = [
  COLORS.orange.primary,
  COLORS.blue.secondary,
  COLORS.cyan.accent,
  COLORS.orangeAlt.primary,
  COLORS.orangeAlt.secondary,
  '#8B5CF6', // Roxo para variedade
  '#10B981', // Verde para variedade
  '#EF4444', // Vermelho para variedade
];

// Custom Tooltip para gráficos
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          {payload[0].name}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {payload[0].value} {payload[0].payload.label || ''}
        </p>
      </div>
    );
  }
  return null;
};

export function AdminDashboard() {
  const { getGlobalMetrics, isLoading } = useAdminApi();
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setError(null);
      const data = await getGlobalMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
      if (err && typeof err === 'object' && 'message' in err) {
        setError(err.message as string);
      } else if (typeof err === 'string') {
        setError(err);
      } else {
        setError('Falha ao carregar dados do dashboard');
      }
    }
  };

  const getActivityIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warn':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityColor = (level: string) => {
    switch (level) {
      case 'critical':
      case 'error':
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      case 'warn':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      case 'info':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
      default:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-950/20';
    }
  };

  // Preparar dados para gráfico de Registration Keys
  const registrationKeysChartData = metrics?.registrationKeys?.map((key) => ({
    name: key.accountType,
    value: key.count,
    fill: CHART_COLORS[metrics.registrationKeys.indexOf(key) % CHART_COLORS.length],
  })) || [];

  // Preparar dados para gráfico de Top Endpoints
  const topEndpointsChartData =
    metrics?.apiUsage?.endpoints
      ?.sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((ep, index) => ({
        name: ep.name,
        acessos: ep.count,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      })) || [];

  if (isLoading && !metrics) {
    return (
      <AdminLayout>
        <div className="space-y-6 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-gray-400 mt-1 text-sm md:text-base">
                Visão geral do sistema e métricas globais
              </p>
            </div>
            <Button
              onClick={loadMetrics}
              disabled={isLoading}
              className="bg-[#e19a00] hover:bg-[#c78b00] text-white border-0"
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
          <div className="animate-pulse">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-32 bg-gray-800 rounded-lg border border-gray-700"
                ></div>
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-4 md:p-6">
          <div className="bg-red-950/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg shadow-sm">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <div>
                <strong className="font-bold">Erro: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 bg-[#1B223C] min-h-screen">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400 mt-1 text-sm md:text-base">
              Visão geral do sistema e métricas globais
            </p>
          </div>
          <Button
            onClick={loadMetrics}
            disabled={isLoading}
            className="bg-[#e19a00] hover:bg-[#c78b00] text-white border-0 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Atualizar
          </Button>
        </div>

        {/* Métricas Principais - Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Total Users */}
          <Card className="bg-[#2A2F45] border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                Total de Usuários
              </CardTitle>
              <div className="p-2 bg-[#3B82F6]/20 rounded-lg">
                <Users className="h-4 w-4 text-[#3B82F6]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {metrics?.users.total || 0}
              </div>
              <p className="text-xs text-gray-400 mt-1">Em todos os tenants</p>
            </CardContent>
          </Card>

          {/* Active Tenants */}
          <Card className="bg-[#2A2F45] border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                Tenants Ativos
              </CardTitle>
              <div className="p-2 bg-[#e19a00]/20 rounded-lg">
                <Building className="h-4 w-4 text-[#e19a00]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {metrics?.tenants.active || 0}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {metrics?.tenants.total || 0} total
              </p>
            </CardContent>
          </Card>

          {/* Registration Keys */}
          <Card className="bg-[#2A2F45] border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                Chaves de Registro
              </CardTitle>
              <div className="p-2 bg-[#F5A100]/20 rounded-lg">
                <Key className="h-4 w-4 text-[#F5A100]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {metrics?.registrationKeys.reduce((sum, key) => sum + key.count, 0) || 0}
              </div>
              <p className="text-xs text-gray-400 mt-1">Chaves ativas</p>
            </CardContent>
          </Card>

          {/* Judit Queries */}
          <Card className="bg-[#2A2F45] border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                Consultas Judit (7d)
              </CardTitle>
              <div className="p-2 bg-[#06B6D4]/20 rounded-lg">
                <Database className="h-4 w-4 text-[#06B6D4]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {metrics?.apiUsage?.juditQueries || 0}
              </div>
              <p className="text-xs text-gray-400 mt-1">Chamadas à API Judit</p>
            </CardContent>
          </Card>

          {/* API Write Ops */}
          <Card className="bg-[#2A2F45] border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                Operações de Escrita (7d)
              </CardTitle>
              <div className="p-2 bg-[#FFB733]/20 rounded-lg">
                <Zap className="h-4 w-4 text-[#FFB733]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {metrics?.apiUsage?.totalWriteOps || 0}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Create/Update/Delete em endpoints
              </p>
            </CardContent>
          </Card>

          {/* System Health */}
          <Card className="bg-[#2A2F45] border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                Saúde do Sistema
              </CardTitle>
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">Saudável</div>
              <p className="text-xs text-gray-400 mt-1">Todos os sistemas operacionais</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos e Seções */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Registration Keys by Account Type - Gráfico de Pizza */}
          {metrics?.registrationKeys && metrics.registrationKeys.length > 0 && (
            <Card className="bg-[#2A2F45] border-gray-700 shadow-lg">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#e19a00]" />
                  Chaves de Registro por Tipo de Conta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-full md:w-1/2">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={registrationKeysChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {registrationKeysChartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.fill || CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          wrapperStyle={{ color: '#E5E7EB' }}
                          formatter={(value) => (
                            <span style={{ color: '#E5E7EB' }}>{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-1/2 space-y-3">
                    {metrics.registrationKeys.map((keyType, index) => (
                      <div
                        key={keyType.accountType}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{
                              backgroundColor:
                                CHART_COLORS[index % CHART_COLORS.length],
                            }}
                          ></div>
                          <div>
                            <p className="font-medium text-white">{keyType.accountType}</p>
                            <p className="text-xs text-gray-400">Tipo de Conta</p>
                          </div>
                        </div>
                        <Badge
                          className="text-lg px-3 py-1 bg-[#e19a00]/20 text-[#e19a00] border-[#e19a00]/30"
                        >
                          {keyType.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Endpoints - Gráfico de Barras */}
          {metrics?.apiUsage?.endpoints && metrics.apiUsage.endpoints.length > 0 && (
            <Card className="bg-[#2A2F45] border-gray-700 shadow-lg">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#3B82F6]" />
                  Endpoints Mais Acessados (7d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={topEndpointsChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                    />
                    <Bar dataKey="acessos" radius={[8, 8, 0, 0]}>
                      {topEndpointsChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.fill || CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent System Activity - Melhorado */}
        <Card className="bg-[#2A2F45] border-gray-700 shadow-lg">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#06B6D4]" />
              Atividade Recente do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics?.recentActivity && metrics.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {metrics.recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className={`p-4 border-l-4 rounded-lg ${getActivityColor(
                        activity.level
                      )} shadow-sm hover:shadow-md transition-shadow bg-gray-800/50 border-gray-700`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5">{getActivityIcon(activity.level)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white mb-2">
                            {activity.message}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                            {activity.tenantName && (
                              <Badge
                                variant="outline"
                                className="bg-[#e19a00]/10 text-[#e19a00] border-[#e19a00]/30"
                              >
                                Tenant: {activity.tenantName}
                              </Badge>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(activity.createdAt).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Nenhuma atividade recente</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
