import { requireAdmin, successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Nama lengkap dosen wajib diisi'),
});

export async function GET() {
  const { error, session } = await requireAdmin();
  if (error || !session) return error;

  try {
    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    if (!admin) {
      return errorResponse('Akun tidak ditemukan', 404);
    }

    return successResponse(admin);
  } catch (err) {
    console.error('Error fetching admin profile:', err);
    return errorResponse('Gagal mengambil data profil', 500);
  }
}

export async function PUT(request: Request) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error;

  try {
    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message || 'Input tidak valid', 400);
    }

    const { name } = validation.data;

    const updated = await prisma.admin.update({
      where: { id: session.user.id },
      data: {
        name: name.trim(),
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
      },
    });

    return successResponse(updated);
  } catch (err) {
    console.error('Error updating admin profile:', err);
    return errorResponse('Gagal memperbarui profil', 500);
  }
}
