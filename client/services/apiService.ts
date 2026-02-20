/**
 * API SERVICE - INTEGRAÇÃO COM BACKEND
 * ===================================
 *
 * Serviço centralizado para todas as chamadas de API.
 * Substitui os dados mock por integrações reais com o backend.
 */

class ApiService {
  private baseUrl = '/api';
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('access_token');
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    // Always get fresh token from localStorage
    this.token = localStorage.getItem('access_token');

    const isFormData = options.body && typeof FormData !== 'undefined' && options.body instanceof FormData;
    const config: RequestInit = {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Token expired, try to refresh
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry with new token
          config.headers = {
            ...config.headers,
            'Authorization': `Bearer ${this.token}`,
          };
          const retryResponse = await fetch(url, config);
          if (!retryResponse.ok) {
            throw new Error(`API Error: ${retryResponse.status}`);
          }
          return retryResponse.json();
        } else {
          // Redirect to login
          window.location.href = '/login';
          throw new Error('Authentication required');
        }
      }

      if (response.status === 403) {
        const error = await response.json().catch(() => ({}));
        const code = error?.code || '';
        const message = error?.message || '';
        const isAuthRelated =
          code.startsWith('AUTH_') ||
          code.startsWith('TENANT_') ||
          code.startsWith('ADMIN_AUTH_') ||
          /invalid.*token|expired.*token/i.test(message);
        if (error?.code === 'PLAN_REQUIRED') {
          window.location.href = '/configuracoes?aviso=plano-requerido';
          throw new Error(error.message || 'Plan required');
        }
        if (isAuthRelated) {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            config.headers = {
              ...config.headers,
              'Authorization': `Bearer ${this.token}`,
            };
            const retryResponse = await fetch(url, config);
            if (!retryResponse.ok) {
              window.location.href = '/login';
              throw new Error(error.message || 'Authentication required');
            }
            return retryResponse.json();
          }
          window.location.href = '/login';
          throw new Error(error.message || 'Authentication required');
        }
        window.location.href = '/acesso-negado';
        throw new Error(error.message || 'Access denied');
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `API Error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return false;

      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.token = data.tokens.accessToken;
        localStorage.setItem('access_token', data.tokens.accessToken);
        localStorage.setItem('refresh_token', data.tokens.refreshToken);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('access_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  // Authentication
  async login(email: string, password: string) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.setToken(response.tokens.accessToken);
    localStorage.setItem('refresh_token', response.tokens.refreshToken);

    return response;
  }

  async register(email: string, password: string, name: string, key: string) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, key }),
    });

    this.setToken(response.tokens.accessToken);
    localStorage.setItem('refresh_token', response.tokens.refreshToken);

    return response;
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    this.clearToken();
  }

  async getProfile() {
    return this.request('/auth/me');
  }

  // Dashboard - Unified endpoint
  async getDashboard() {
    console.log('🔄 Requesting dashboard data from /api/dashboard');
    return this.request('/dashboard');
  }

  // Dashboard specific methods
  async getDashboardMetrics() {
    console.log('🔄 Requesting dashboard metrics from /api/dashboard/metrics');
    return this.request('/dashboard/metrics');
  }

  async getRecentActivity(limit: number = 10) {
    console.log('🔄 Requesting recent activity from /api/dashboard/recent-activity');
    return this.request(`/dashboard/recent-activity?limit=${limit}`);
  }

  async getChartData(period: string = '30d') {
    console.log('🔄 Requesting chart data from /api/dashboard/chart-data');
    return this.request(`/dashboard/chart-data?period=${period}`);
  }

  // Clients
  async getClients(params?: any) {
    const query = new URLSearchParams(params || {}).toString();
    return this.request(`/clients?${query}`, {
      method: 'GET',
    });
  }

  async getClient(id: string) {
    return this.request(`/clients/${id}`);
  }

  async createClient(data: any) {
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClient(id: string, data: any) {
    return this.request(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClient(id: string) {
    return this.request(`/clients/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadClientAttachments(id: string, form: FormData) {
    return this.request(`/clients/${id}/attachments`, {
      method: 'POST',
      body: form,
    });
  }

  async getClientAttachments(id: string) {
    return this.request(`/clients/${id}/attachments`, {
      method: 'GET',
    });
  }

  async deleteClientAttachments(id: string, files: string[]) {
    return this.request(`/clients/${id}/attachments/delete`, {
      method: 'POST',
      body: JSON.stringify({ files }),
    });
  }

  // Deals (CRM Pipeline)
  async getDeals(params: any = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/deals?${query}`);
  }

  async getDeal(id: string) {
    return this.request(`/deals/${id}`);
  }

  async createDeal(data: any) {
    return this.request('/deals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDeal(id: string, data: any) {
    return this.request(`/deals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDeal(id: string) {
    return this.request(`/deals/${id}`, {
      method: 'DELETE',
    });
  }
  async uploadDealAttachments(id: string, form: FormData) {
    return this.request(`/deals/${id}/attachments`, {
      method: 'POST',
      body: form,
    });
  }
  async getDealAttachments(id: string) {
    return this.request(`/deals/${id}/attachments`, {
      method: 'GET',
    });
  }
  async deleteDealAttachments(id: string, files: string[]) {
    return this.request(`/deals/${id}/attachments/delete`, {
      method: 'POST',
      body: JSON.stringify({ files }),
    });
  }

  // Projects
  async getProjects(params: any = {}) {
    const query = new URLSearchParams(params || {}).toString();
    return this.request(`/projects?${query}`);
  }

  async getProject(id: string) {
    return this.request(`/projects/${id}`);
  }

  async createProject(data: any) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: any) {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string) {
    return this.request(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadProjectAttachments(id: string, form: FormData) {
    return this.request(`/projects/${id}/attachments`, {
      method: 'POST',
      body: form,
    });
  }
  async getProjectAttachments(id: string) {
    return this.request(`/projects/${id}/attachments`, {
      method: 'GET',
    });
  }
  async deleteProjectAttachments(id: string, files: string[]) {
    return this.request(`/projects/${id}/attachments/delete`, {
      method: 'POST',
      body: JSON.stringify({ files }),
    });
  }
  async getProjectsStats() {
    return this.request('/projects/stats');
  }

  // Tasks
  async getTasks(params: any = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/tasks?${query}`);
  }

  async getTask(id: string) {
    return this.request(`/tasks/${id}`);
  }

  async createTask(data: any): Promise<any> {
    console.log('[ApiService] Creating task with data:', data);
    try {
      const response = await this.request('/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      console.log('[ApiService] Task created successfully:', response);
      return response;
    } catch (error) {
      console.error('[ApiService] Error creating task:', error);
      throw error;
    }
  }

  async updateTask(id: string, data: any) {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async getTaskStats() {
    return this.request('/tasks/stats/overview');
  }

  // Transactions (Cash Flow)
  async getTransactions(params: any = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/transactions?${query}`);
  }

  async getTransactionsStats(params: any = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/transactions/stats/overview${query ? `?${query}` : ''}`);
  }

  async getTransactionsByCategory(params: any = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/transactions/reports/by-category${query ? `?${query}` : ''}`);
  }

  async listRecurringTransactions() {
    return this.request(`/transactions/recurring/list`);
  }

  async runRecurringTransactions() {
    return this.request(`/transactions/recurring/run`, { method: 'POST' });
  }

  async getTransaction(id: string) {
    return this.request(`/transactions/${id}`);
  }

  async createTransaction(data: any) {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTransaction(id: string, data: any) {
    return this.request(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTransaction(id: string) {
    return this.request(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  // Publications
  async getPublications(params: any = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/publications?${query}`);
  }

  async getPublication(id: string) {
    return this.request(`/publications/${id}`);
  }

  async updatePublication(id: string, data: any) {
    return this.request(`/publications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePublication(id: string) {
    return this.request(`/publications/${id}`, { method: 'DELETE' });
  }

  async importCodiloPublications(data: { oabNumber: string; uf: string; dateFrom?: string; dateTo?: string }) {
    return this.request(`/publications/import/codilo`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async searchCodiloProcesses(params: { oabNumber: string; uf: string }) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/publications/external/codilo/search?${query}`);
  }

  async registerJuditTracking(data: any) {
    return this.request('/publications/external/judit/tracking', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listJuditTrackings(params: any = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/publications/external/judit/trackings?${query}`);
  }

  async getJuditTracking(id: string) {
    return this.request(`/publications/external/judit/trackings/${id}`);
  }

  async pauseJuditTracking(id: string) {
    return this.request(`/publications/external/judit/trackings/${id}/pause`, { method: 'POST' });
  }

  async resumeJuditTracking(id: string) {
    return this.request(`/publications/external/judit/trackings/${id}/resume`, { method: 'POST' });
  }

  async deleteJuditTracking(id: string) {
    return this.request(`/publications/external/judit/trackings/${id}`, { method: 'DELETE' });
  }

  async getJuditTrackingHistory(id: string, params: any = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/publications/external/judit/trackings/${id}/history?${query}`);
  }
  async getJuditHistoryItem(responseId: string) {
    return this.request(`/publications/external/judit/history/${responseId}`);
  }

  async lookupJuditHistory(params: { search_type: string; search_key: string }, fromClient?: boolean) {
    const query = new URLSearchParams({ ...params, ...(fromClient ? { fromClient: 'true' } : {}) } as any).toString();
    return this.request(`/publications/external/judit/history/lookup?${query}`);
  }
  async lookupJuditHistoryPublic(params: { search_type: string; search_key: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/publications/external/judit/history/lookup?${query}`);
  }

  async createJuditRequest(data: any, fromClient?: boolean) {
    return this.request(`/publications/external/judit/requests?fromClient=${fromClient || false}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createPublicJuditRequest(data: any, fromClient?: boolean) {
    return this.request(`/publications/external/judit/public/requests?fromClient=${fromClient || false}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listJuditRequests() {
    return this.request('/publications/external/judit/requests');
  }

  async getJuditRequest(id: string) {
    return this.request(`/publications/external/judit/requests/${id}`);
  }

  async refreshJuditRequest(id: string) {
    return this.request(`/publications/external/judit/requests/${id}/refresh`, {
      method: 'POST',
    });
  }

  // Invoices (Billing)
  async getInvoices(params: any = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/invoices?${query}`);
  }

  async getInvoice(id: string) {
    return this.request(`/invoices/${id}`);
  }

  async createInvoice(data: any) {
    return this.request('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInvoice(id: string, data: any) {
    return this.request(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteInvoice(id: string) {
    return this.request(`/invoices/${id}`, {
      method: 'DELETE',
    });
  }

  async getInvoiceStats() {
    return this.request('/invoices/stats/overview');
  }

  async createReceivableCheckoutSession(invoiceId: string, options?: { successUrl?: string; cancelUrl?: string }) {
    return this.request(`/invoices/${invoiceId}/stripe-checkout`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }


  // Notifications endpoints
  async getNotifications(params: any = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/notifications?${queryString}`);
  }

  async getUnreadCount() {
    return this.request('/notifications/unread-count');
  }

  async createNotification(data: any) {
    return this.request('/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async markNotificationAsRead(id: string) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/mark-all-read', {
      method: 'PATCH',
      body: JSON.stringify({ markAll: true }),
    });
  }

  async deleteNotification(id: string) {
    return this.request(`/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  // Generic HTTP methods
  async get(endpoint: string, params?: any) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request(`${endpoint}${query}`);
  }

  async post(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  async stripeConnectCreateAccount(returnUrl: string, refreshUrl?: string) {
    return this.post('/stripe/connect/account/create', { returnUrl, refreshUrl: refreshUrl || returnUrl });
  }
  async stripeConnectLoginLink() {
    return this.post('/stripe/connect/account/login', {});
  }

  async put(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }

  // Estimates (Billing)
  async getEstimates(params: any = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/estimates?${query}`);
  }
  async getEstimate(id: string) {
    return this.request(`/estimates/${id}`);
  }
  async createEstimate(data: any) {
    return this.request('/estimates', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateEstimate(id: string, data: any) {
    return this.request(`/estimates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteEstimate(id: string) {
    return this.request(`/estimates/${id}`, { method: 'DELETE' });
  }
  async getEstimateStats() {
    return this.request('/estimates/stats/overview');
  }
  // Colaboradores (usuários do tenant atual)
  async getCollaborators(params?: { status?: 'active' | 'inactive' | 'all'; accountType?: 'SIMPLES' | 'COMPOSTA' | 'GERENCIAL'; search?: string; limit?: number; page?: number }) {
    const query = new URLSearchParams(
      Object.entries(params || {}).reduce((acc, [ k, v ]) => {
        if (v !== undefined && v !== null) acc[ k ] = String(v);
        return acc;
      }, {} as Record<string, string>)
    ).toString();

    return this.request(`/users/collaborators${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }
  // Emails (Resend via backend)
  async sendEmail(data: any) {
    return this.request('/emails/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async sendWhatsappMessage(data: { number: string; text: string; instanceName?: string }) {
    return this.request('/evolution/message/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getInstanceNames() {
    return this.request('/evolution/instances');
  }

  async getSelectedInstance(tenantId: string) {
    return this.request(`/evolution/selected?tenantId=${encodeURIComponent(tenantId)}`);
  }
  async scheduleReceivableNotification(data: { clientPhone: string; message: string; scheduledDate: string; scheduledTime: string; invoiceId?: string }) {
    return this.request('/receivables/notifications/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async getScheduledNotifications(limit: number = 200) {
    return this.request(`/receivables/notifications/scheduled?limit=${limit}`);
  }
  async updateScheduledNotification(id: string, patch: any) {
    return this.request(`/receivables/notifications/scheduled/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }
  async deleteScheduledNotification(id: string) {
    return this.request(`/receivables/notifications/scheduled/${id}`, {
      method: 'DELETE',
    });
  }

  async updateProfile(data: any) {
    return this.request('/auth/me', {
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data),
    })
  }

  async deleteSchedule(notificationId: string) {
    return this.request(`/receivables/notifications/scheduled/${notificationId}`, { method: 'DELETE' })
  }
}



export const apiService = new ApiService();
