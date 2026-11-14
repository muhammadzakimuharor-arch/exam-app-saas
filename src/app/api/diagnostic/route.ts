import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const testHost = url.searchParams.get('host') || 'aws-0-ap-southeast-1.pooler.supabase.com';
  const testPort = url.searchParams.get('port') || '6543';
  const mode = url.searchParams.get('mode') || 'transaction';

  const user = mode === 'transaction' || testPort === '6543'
    ? 'postgres.pyvnphypseywhgofpleo'
    : 'postgres';

  const testConnStr = `postgresql://${user}:xRek58R69t5aZz31@${testHost}:${testPort}/postgres?pgbouncer=true&sslmode=require`;

  const prismaTest = new PrismaClient({
    datasources: { db: { url: testConnStr } },
  });

  try {
    const adminCount = await prismaTest.admin.count();
    await prismaTest.$disconnect();
    return NextResponse.json({
      status: 'SUCCESS',
      host: testHost,
      port: testPort,
      connStrSanitized: testConnStr.replace('xRek58R69t5aZz31', '***'),
      adminCount,
    });
  } catch (err: any) {
    await prismaTest.$disconnect();
    return NextResponse.json({
      status: 'FAILED',
      host: testHost,
      port: testPort,
      error: err.message,
    });
  }
}
