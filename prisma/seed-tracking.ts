/**
 * Seed de dados de tracking para o dashboard (DEV/demo).
 * Gera ~30 dias de sessões, eventos, atribuição e leads para o site health-voice,
 * com um funil realista (vai estreitando page_view → cta → form → lead).
 *
 * Rodar:  yarn db:seed:tracking
 * Idempotente: limpa os dados de tracking do site antes de inserir.
 */
import { randomUUID, createHash } from 'crypto';
import { PrismaClient, TrackingLeadStatus } from '@prisma/client';

const prisma = new PrismaClient();

const SITE_SLUG = 'health-voice';
const DAYS = 30;

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const chance = (p: number): boolean => Math.random() < p;
const between = (min: number, max: number): number =>
  Math.floor(min + Math.random() * (max - min + 1));

const UTM_SOURCES = ['google', 'facebook', 'instagram', 'tiktok', null, null, null];
const PATHS = ['/medical/campaing1', '/precos', '/para-medicos', '/ia-health'];
const DEVICES = ['mobile', 'mobile', 'mobile', 'desktop', 'desktop', 'tablet'];
const CTA_IDS = [
  'cta_hero_usar_gratuitamente',
  'cta_oferta_usar_gratuitamente',
  'cta_hero_whatsapp',
  'cta_passos_usar_gratuitamente',
];
const FIRST_NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elaine', 'Felipe', 'Gabriela', 'Hugo'];
const STATUSES: TrackingLeadStatus[] = [
  'NEW', 'NEW', 'NEW', 'CONTACTED', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST',
];

async function chunkedCreate<T>(
  rows: T[],
  create: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += 1000) {
    await create(rows.slice(i, i + 1000));
  }
}

async function main() {
  const site = await prisma.site.findUnique({ where: { slug: SITE_SLUG } });
  if (!site) throw new Error(`Site "${SITE_SLUG}" não encontrado — cadastre-o antes.`);
  const siteId = site.id;

  // limpa dados anteriores do site (re-run idempotente)
  await prisma.trackingEvent.deleteMany({ where: { siteId } });
  await prisma.trackingAttribution.deleteMany({ where: { siteId } });
  await prisma.trackingLead.deleteMany({ where: { siteId } });
  await prisma.trackingConsentLog.deleteMany({ where: { siteId } });
  await prisma.trackingSession.deleteMany({ where: { siteId } });

  const sessions: any[] = [];
  const events: any[] = [];
  const attributions: any[] = [];
  const leads: any[] = [];

  // pool de anonymousIds — alguns reaparecem (visitante recorrente)
  const anonPool = Array.from({ length: 220 }, () => randomUUID());

  for (let d = DAYS - 1; d >= 0; d--) {
    // leve tendência de crescimento + ruído
    const base = 12 + Math.round((DAYS - d) * 0.6);
    const count = between(Math.max(5, base - 8), base + 10);

    for (let i = 0; i < count; i++) {
      const startedAt = new Date(Date.now() - d * 86_400_000);
      startedAt.setHours(between(7, 22), between(0, 59), between(0, 59), 0);

      const sessionId = randomUUID();
      const anonymousId = chance(0.25) ? pick(anonPool) : randomUUID();
      const device = pick(DEVICES);
      const landing = pick(PATHS);
      const utmSource = pick(UTM_SOURCES);
      const lastSeenAt = new Date(startedAt.getTime() + between(20, 600) * 1000);

      sessions.push({
        siteId, anonymousId, sessionId, startedAt, lastSeenAt,
        firstLandingPath: landing,
        userAgent: device === 'desktop' ? 'Mozilla/5.0 Desktop' : 'Mozilla/5.0 Mobile',
        deviceType: device,
        locale: 'pt-BR',
        ipHash: createHash('sha256').update(`${sessionId}|seed`).digest('hex'),
        country: 'BR',
        isBot: false,
      });

      if (utmSource || chance(0.3)) {
        attributions.push({
          sessionId, siteId, anonymousId,
          utmSource,
          utmMedium: utmSource ? 'cpc' : null,
          utmCampaign: utmSource ? pick(['institucional', 'campaing1', 'remarketing']) : null,
          referrer: utmSource ? null : pick(['https://google.com', 'https://t.co', null]),
          landingPath: landing,
          createdAt: startedAt,
        });
      }

      const ev = (name: string, extra: Record<string, unknown> = {}) => {
        const occurredAt = new Date(startedAt.getTime() + between(1, 500) * 1000);
        events.push({
          eventId: randomUUID(), siteId, sessionId, anonymousId, name,
          path: landing, occurredAt, schemaVersion: 1,
          ...extra,
        });
      };

      // funil
      const pageViews = between(1, 4);
      for (let p = 0; p < pageViews; p++) {
        ev('page_view', { properties: { path: pick(PATHS), title: 'Health Voice' } });
      }
      const reachedCta = chance(0.38);
      if (reachedCta) {
        const cta = pick(CTA_IDS);
        ev('cta_click', { elementId: cta, properties: { label: 'Usar Gratuitamente' } });

        const reachedFormView = chance(0.55);
        if (reachedFormView) {
          ev('form_view', { elementId: 'form_campaign_lead', properties: {} });

          const reachedSubmit = chance(0.5);
          if (reachedSubmit) {
            ev('form_submit', {
              elementId: 'form_campaign_lead',
              properties: { fields: ['nome', 'email', 'telefone'] },
            });

            if (chance(0.82)) {
              const leadId = randomUUID();
              const name = `${pick(FIRST_NAMES)} ${pick(['Silva', 'Souza', 'Lima', 'Costa'])}`;
              const email = `${name.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`;
              ev('lead_created', { properties: { leadId, source: 'campaing1' } });
              leads.push({
                id: leadId, siteId, sessionId, anonymousId, name, email,
                phone: `(41) 9${between(1000, 9999)}-${between(1000, 9999)}`,
                source: 'campaing1',
                utmSource,
                utmCampaign: utmSource ? 'campaing1' : null,
                status: pick(STATUSES),
                consentLgpd: false,
                ipHash: createHash('sha256').update(`${leadId}|seed`).digest('hex'),
                createdAt: new Date(startedAt.getTime() + between(60, 800) * 1000),
              });
            }
          }
        }
      }
    }
  }

  await chunkedCreate(sessions, (b) => prisma.trackingSession.createMany({ data: b }));
  await chunkedCreate(attributions, (b) =>
    prisma.trackingAttribution.createMany({ data: b }),
  );
  await chunkedCreate(events, (b) => prisma.trackingEvent.createMany({ data: b }));
  await chunkedCreate(leads, (b) => prisma.trackingLead.createMany({ data: b }));

  console.log(
    `[seed-tracking] ${SITE_SLUG}: ${sessions.length} sessões, ${events.length} eventos, ` +
      `${attributions.length} atribuições, ${leads.length} leads.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
