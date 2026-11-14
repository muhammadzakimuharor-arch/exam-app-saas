import { requireSuperAdmin, successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const updateLecturerSchema = z.object({
  name: z.string().min(1, 'Nama lengkap wajib diisi').optional(),
  password: z.string().min(4, 'Password minimal 4 karakter').optional().or(z.literal('')),
  role: z.enum(['dosen', 'superadmin']).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireSuperAdmin();
  if (error || !session) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = updateLecturerSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message || 'Input tidak valid', 400);
    }

    const lecturer = await prisma.admin.findUnique({
      where: { id },
    });

    if (!lecturer) {
      return errorResponse('Akun dosen tidak ditemukan', 404);
    }

    const { name, password, role } = validation.data;
    const updateData: any = {};

    if (name) {
      updateData.name = name.trim();
    }

    if (role && (role === 'dosen' || role === 'superadmin')) {
      // Jika mencoba mengubah role diri sendiri menjadi non-superadmin, cegah agar tidak terkunci
      if (id === session.user.id && role !== 'superadmin') {
        return errorResponse('Anda tidak dapat mencabut hak akses Super Admin dari akun Anda sendiri', 400);
      }
      updateData.role = role;
    }

    if (password && password.trim().length >= 4) {
      updateData.passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const updated = await prisma.admin.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
      },
    });

    return successResponse(updated);
  } catch (err) {
    console.error('Error updating lecturer:', err);
    return errorResponse('Gagal memperbarui akun dosen', 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireSuperAdmin();
  if (error || !session) return error;

  try {
    const { id } = await params;

    if (id === session.user.id) {
      return errorResponse('Anda tidak dapat menghapus akun Anda sendiri yang sedang login', 400);
    }

    const lecturer = await prisma.admin.findUnique({
      where: { id },
      include: {
        _count: {
          select: { classes: true },
        },
      },
    });

    if (!lecturer) {
      return errorResponse('Akun dosen tidak ditemukan', 404);
    }

    // Hapus akun dosen. Relasi Class.adminId onDelete: SetNull akan membuat kelas tetap aman
    await prisma.admin.delete({
      where: { id },
    });

    return successResponse({
      message: `Akun dosen ${lecturer.name} (${lecturer.username}) berhasil dihapus`,
    });
  } catch (err) {
    console.error('Error deleting lecturer:', err);
    return errorResponse('Gagal menghapus akun dosen', 500);
  }
}
