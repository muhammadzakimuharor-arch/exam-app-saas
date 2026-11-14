import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const envCheck = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDirectUrl: !!process.env.DIRECT_URL,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    hasNextAuthUrl: process.env.NEXTAUTH_URL || null,
    databaseUrlHost: process.env.DATABASE_URL ? process.env.DATABASE_URL.split('@')[1] : null,
  };

  let dbStatus = 'untested';
  let dbError = null;

  try {
    const adminCount = await prisma.admin.count();
    dbStatus = `connected, found ${adminCount} admins`;
  } catch (err: any) {
    dbStatus = 'failed';
    dbError = {
      message: err.message,
      code: err.code,
    };
  }

  return NextResponse.json({
    envCheck,
    dbStatus,
    dbError,
  });
}
