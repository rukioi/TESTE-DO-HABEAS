-- =============================================================================
-- SQL para adicionar colunas de recuperação de senha na tabela public.users
-- Execute este script no Supabase (SQL Editor) se preferir aplicar manualmente
-- ou se a migration Prisma não for usada.
-- =============================================================================
-- No Habeas-Desk, os usuários ficam apenas em public.users (não há tabela users
-- por tenant). Todos os tenants compartilham a mesma tabela public.users
-- (identificados por tenant_id). Novos tenants NÃO criam tabela de users;
-- portanto, adicionar estas colunas em public.users é suficiente para todos
-- os tenants atuais e futuros.
-- =============================================================================

-- Tabela public.users (única tabela de usuários do app)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS reset_token TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP(3);

-- Opcional: comentários para documentação
COMMENT ON COLUMN public.users.reset_token IS 'Token único para link de recuperação de senha (uso único, 1h)';
COMMENT ON COLUMN public.users.reset_token_expires IS 'Data/hora de expiração do token de recuperação';
