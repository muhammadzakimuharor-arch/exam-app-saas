import { requireAdmin, successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateClassSchema = z.object({
  name: z.string().min(1, 'Nama kelas wajib diisi'),
  level: z.string().optional(),
  description: z.string().optional(),
  adminId: z.string().optional(), // Khusus superadmin
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error;

  try {
    const { id } = await params;

    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        subject: true,
        admin: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        exams: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
            },
            _count: {
              select: { questions: true, sessions: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        students: {
          orderBy: { nim: 'asc' },
        },
        _count: {
          select: { exams: true, students: true },
        },
      },
    });

    if (!classData) {
      return errorResponse('Kelas tidak ditemukan', 404);
    }

    // 1 Dosen 1 Pintu: Cek kepemilikan kelas jika bukan superadmin
    if (session.user.role !== 'superadmin' && classData.adminId !== session.user.id) {
      return errorResponse('Akses ditolak: Anda tidak memiliki akses ke kelas ini', 403);
    }

    return successResponse(classData);
  } catch (err) {
    console.error('Error fetching class:', err);
    return errorResponse('Gagal mengambil data kelas', 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = updateClassSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message || 'Input tidak valid', 400);
    }

    const existing = await prisma.class.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Kelas tidak ditemukan', 404);
    }

    // 1 Dosen 1 Pintu: Cek kepemilikan kelas jika bukan superadmin
    if (session.user.role !== 'superadmin' && existing.adminId !== session.user.id) {
      return errorResponse('Akses ditolak: Anda tidak memiliki izin mengedit kelas ini', 403);
    }

    const { name, level, description, adminId } = validation.data;

    // Cek duplikasi nama di bawah dosen pemilik kelas tersebut
    const targetAdminId = (session.user.role === 'superadmin' && adminId !== undefined)
      ? adminId
      : existing.adminId;

    const duplicate = await prisma.class.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        id: { not: id },
        adminId: targetAdminId,
      },
    });

    if (duplicate) {
      return errorResponse(`Kelas dengan nama "${name.trim()}" sudah ada`, 400);
    }

    const updatedClass = await prisma.class.update({
      where: { id },
      data: {
        name: name.trim(),
        level: level !== undefined ? (level?.trim() || null) : existing.level,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        ...(session.user.role === 'superadmin' && adminId !== undefined ? { adminId: adminId || null } : {}),
      },
      include: {
        subject: true,
        admin: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        exams: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { exams: true, students: true },
        },
      },
    });

    return successResponse(updatedClass);
  } catch (err) {
    console.error('Error updating class:', err);
    return errorResponse('Gagal mengupdate kelas', 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error;

  try {
    const { id } = await params;

    const existing = await prisma.class.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Kelas tidak ditemukan', 404);
    }

    // 1 Dosen 1 Pintu: Cek kepemilikan kelas jika bukan superadmin
    if (session.user.role !== 'superadmin' && existing.adminId !== session.user.id) {
      return errorResponse('Akses ditolak: Anda tidak memiliki izin menghapus kelas ini', 403);
    }

    await prisma.class.delete({ where: { id } });

    return successResponse({ message: 'Kelas berhasil dihapus' });
  } catch (err) {
    console.error('Error deleting class:', err);
    return errorResponse('Gagal menghapus kelas', 500);
  }
}
