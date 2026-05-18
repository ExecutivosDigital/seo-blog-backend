import { PrismaClient, AdminRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@seoblog.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? '123456';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Admin';

  console.log('[seed] hashing admin password…');
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: passwordHash,
      name: adminName,
      role: AdminRole.ADMIN,
      active: true,
    },
  });
  console.log(`[seed] admin: ${admin.email} (id=${admin.id})`);

  const healthVoice = await prisma.site.upsert({
    where: { slug: 'health-voice' },
    update: {},
    create: {
      slug: 'health-voice',
      name: 'Health Voice',
      domain: 'healthvoice.com.br',
      authorName: 'Health Voice',
      toneOfVoice:
        'Profissional, acolhedor, baseado em evidências. Sempre incluir disclaimer de não substituir consulta médica.',
      defaultLocale: 'pt-BR',
      supportedLocales: ['pt-BR', 'en', 'es'],
      ogDefaults: { siteName: 'Health Voice' },
    },
  });
  console.log(`[seed] site: ${healthVoice.name} (${healthVoice.slug})`);

  for (const ct of [
    { slug: 'blog', name: 'Blog', routePrefix: '/blog' },
    { slug: 'noticia', name: 'Notícia', routePrefix: '/noticias' },
  ]) {
    const created = await prisma.contentType.upsert({
      where: { siteId_slug: { siteId: healthVoice.id, slug: ct.slug } },
      update: {},
      create: { ...ct, siteId: healthVoice.id },
    });
    console.log(`[seed] content_type: ${created.slug} → ${created.routePrefix}`);
  }

  // Garante que o admin tem acesso ao site
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { siteAccess: [healthVoice.id] },
  });

  console.log('[seed] done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
