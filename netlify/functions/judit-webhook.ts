import { prisma, database, TenantDatabase } from '../../src/config/database'
import { publicationsService } from '../../src/services/publicationsService'
import { notificationsService } from '../../src/services/notificationsService'
import { codiloService } from '../../src/services/juditService'
import { emailsService } from '../../src/services/emailsService'
import { queryTenantSchema, updateInTenantSchema } from '../../src/utils/tenantHelpers'

export const handler = async (event: any) => {
  try {
    const qs = event?.queryStringParameters || {}
    const tenantId = (qs?.tenantId as string) || ''
    const userIdQS = (qs?.userId as string) || ''

    const raw = event?.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event?.body || '')
    const body = raw ? JSON.parse(raw) : {}

    if (body.payload.response_data.message === "REQUEST_COMPLETED" && body.payload.response_data.code === 600) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Ok' }) };
    }

    const trackingId = (body?.reference_type === 'tracking' && body?.reference_id)
      ? String(body.reference_id)
      : (body?.tracking_id as string) || (body?.id as string) || ''
    const requestRefId = (body?.reference_type === 'request' && body?.reference_id) ? String(body.reference_id) : ''

    const resolvedTenantId = tenantId || (body?.tenantId as string) || ''
    if (!resolvedTenantId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing tenantId' }) }
    }

    const tenant = await database.getTenantById(resolvedTenantId)
    if (!tenant) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Tenant not found' }) }
    }
    const tenantDB = new TenantDatabase(resolvedTenantId, (tenant as any).schemaName)

    let userId: string = userIdQS || (body?.userId as string) || ''
    let notificationEmails: string[] = []
    if (trackingId) {
      try {
        const trackingRow = await codiloService.getLocalTrackingByTrackingId(tenantDB, trackingId)
        if (trackingRow?.user_id) userId = String(trackingRow.user_id)
        if (trackingRow?.notification_emails && Array.isArray(trackingRow.notification_emails)) {
          notificationEmails = (trackingRow.notification_emails as any[]).filter((e: any) => typeof e === 'string' && String(e).trim()).map((e: string) => String(e).trim())
        }
      } catch { }
    }
    if (!userId) {
      try {
        const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: resolvedTenantId } })
        const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {}
        userId = settings?.judit?.trackings?.[ String(trackingId) ]?.userId || ''
      } catch { userId = '' }
    }
    if (!userId) {
      try {
        const firstUser = await prisma.user.findFirst({ where: { tenantId: resolvedTenantId, isActive: true }, orderBy: { createdAt: 'asc' } })
        userId = (firstUser && String(firstUser.id)) || 'system'
      } catch { userId = 'system' }
    } else {
      try {
        const u = await prisma.user.findUnique({ where: { id: userId } })
        if (!u || String(u.tenantId) !== String(resolvedTenantId) || !u.isActive) {
          const firstUser = await prisma.user.findFirst({ where: { tenantId: resolvedTenantId, isActive: true }, orderBy: { createdAt: 'asc' } })
          userId = (firstUser && String(firstUser.id)) || 'system'
        }
      } catch { userId = 'system' }
    }

    const publicationDate = new Date().toISOString().slice(0, 10)
    const payload = (body?.payload as any) || {}
    const responseData = (payload?.response_data as any) || (body?.response_data as any) || body
    const processNumber = (body?.search?.search_key as string) || (responseData?.lawsuit_cnj as string) || (responseData?.code as string) || ''
    const externalId = String(trackingId || processNumber || Date.now())
    const content = JSON.stringify(body)

    // ✅ Quando reference_type === 'request', atualizar judit_requests como o refresh faria
    if (requestRefId) {
      try {
        const rows = await queryTenantSchema<any>(tenantDB, `SELECT * FROM \${schema}.judit_requests WHERE request_id = $1 LIMIT 1`, [ requestRefId ])
        const reqRow = rows?.[ 0 ] || null
        if (reqRow) {
          const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: resolvedTenantId } })
          const apiKey = (cfg?.codiloApiKey && cfg.isActive !== false) ? cfg.codiloApiKey : (process.env.JUDIT_API_KEY as string | undefined)
          if (!apiKey) {
            throw new Error('Judit API key not configured for tenant')
          }
          const url = `https://requests.prod.judit.io/responses?request_id=${encodeURIComponent(requestRefId)}`
          const resp = await fetch(url, { headers: { 'Content-Type': 'application/json', 'api-key': apiKey } })
          if (!resp.ok) {
            const text = await resp.text().catch(() => '')
            throw new Error(`Judit responses fetch failed: ${resp.status} ${text}`)
          }
          const dataJson = await resp.json().catch(() => ({}))
          const data: any = dataJson as any
          const status = data?.request_status || reqRow.status || 'pending'
          await updateInTenantSchema<any>(tenantDB, 'judit_requests', String(reqRow.id), {
            status,
            result: data || {},
          }, true)
          try {
            await notificationsService.createNotification(tenantDB, {
              userId,
              actorId: 'system',
              type: 'system',
              title: 'Consulta Judit atualizada',
              message: `Consulta atualizada pelo webhook: ${requestRefId}`,
              payload: { requestId: String(reqRow.id), juditRequestId: requestRefId, event_type: body?.event_type || null },
              link: `/consultas-judit/${String(reqRow.id)}`
            })
          } catch { }
        }
      } catch (e) {
        console.log('Webhook Judit (request) update error:', e)
      }
    }

    try {
      const item = {
        response_id: String(payload?.response_id || body?.response_id || `${Date.now()}`),
        response_type: String(payload?.response_type || body?.response_type || 'lawsuit'),
        response_data: responseData,
        created_at: body?.timestamp || new Date().toISOString(),
      }
      if (trackingId) {
        try {
          await codiloService.saveTrackingRecord(tenantDB, userId, {
            tracking_id: trackingId,
            status: item?.response_id ? 'updated' : 'created',
            search: body?.search || {},
            hour_range: (body?.hour_range as any) ?? undefined,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        } catch { }
        await codiloService.saveTrackingHistoryRecord(tenantDB, trackingId, item)
        const type = String(body?.event_type || '').toLowerCase()
        const newStatus = type === 'response_created' ? 'updated' : (type ? 'updating' : 'updated')
        await codiloService.updateLocalTrackingStatus(tenantDB, trackingId, newStatus)
        await codiloService.updateLocalTrackingLastWebhookAt(tenantDB, trackingId)
        try {
          await notificationsService.createNotification(tenantDB, {
            userId,
            actorId: 'system',
            type: 'system',
            title: 'Monitoramento atualizado (Judit)',
            message: `Histórico atualizado pelo webhook. Tracking ${trackingId}, resposta ${item.response_id}.`,
            payload: {
              trackingId,
              response_id: item.response_id,
              response_type: item.response_type,
              request_id: (body?.payload as any)?.request_id || body?.request_id || null,
              event_type: body?.event_type || null,
            },
            link: item?.response_id ? `/processos-judit/${item.response_id}` : undefined,
          })
        } catch { }
      }
    } catch { }

    // ✅ Somente monitoramentos geram publicações
    if (trackingId) {
      try {
        const created = await publicationsService.createPublication(tenantDB, userId, {
          oabNumber: 'Judit',
          processNumber,
          publicationDate,
          content,
          source: 'Judit',
          externalId: String((payload?.response_id || body?.response_id) || externalId),
          status: 'nova',
          metadata: {
            trackingId,
            response_id: (payload?.response_id || body?.response_id) || null,
            response_type: (payload?.response_type || body?.response_type) || 'lawsuit',
            search: body?.search || {},
            event_type: body?.event_type || null
          }
        } as any)
        try {
          await notificationsService.createNotification(tenantDB, {
            userId,
            actorId: userId,
            type: 'system',
            title: 'Nova publicação Judit',
            message: `Monitoramento atualizado: ${processNumber || String((payload?.response_id || body?.response_id) || externalId)}`,
            payload: { publicationId: created.id, processNumber, trackingId, response_id: (payload?.response_id || body?.response_id) || null },
            link: `/publicacoes/${created.id}`
          })
        } catch { }
        if (notificationEmails.length > 0 && emailsService.hasSmtpConfig()) {
          try {
            const processLabel = processNumber || trackingId || 'Processo'
            await emailsService.sendEmail({
              to: notificationEmails,
              subject: `Monitoramento Judit atualizado - ${processLabel}`,
              html: `<p>Foi feita uma atualização no seu monitoramento (${processLabel}). Acesse o sistema para ver o conteúdo.</p><p>— Habeas Desk</p>`,
            })
          } catch { }
        }
      } catch { }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) }
  } catch (error: any) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Failed to process Judit webhook', details: error?.message || 'Unknown error' }) }
  }
}
