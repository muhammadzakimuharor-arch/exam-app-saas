import { requireAdmin, successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createClassSchema = z.object({
  name: z.string().min(1, 'Nama kelas wajib diisi'),
  level: z.string().optional(),
  description: z.string().optional(),
  subjectId: z.string().optional(),
  adminId: z.string().optional(), // Khusus superadmin bisa menentukan dosen pengampu
});

export async function GET(request: Request) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error;

  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');

    const whereClause: any = {};
    if (subjectId) {
      whereClause.subjectId = subjectId;
    }

    // RUANGAN TERISOLASI (1 DOSEN 1 PINTU):
    // Jika bukan Super Admin (yaitu Dosen), hanya tampilkan kelas milik dosen yang bersangkutan
    if (session.user.role !== 'superadmin') {
      whereClause.adminId = session.user.id;
    }

    const classes = await prisma.class.findMany({
      where: whereClause,
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
          select: {
            id: true,
            title: true,
            subjectName: true,
            isActive: true,
            durationMinutes: true,
            startTime: true,
            endTime: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { exams: true, students: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return successResponse(classes);
  } catch (err) {
    console.error('Error fetching classes:', err);
    return errorResponse('Gagal mengambil data kelas', 500);
  }
}

export async function POST(request: Request) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error;

  try {
    const body = await request.json();
    const validation = createClassSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message || 'Input tidak valid', 400);
    }

    const { name, level, description, subjectId, adminId } = validation.data;

    // Tentukan pemilik kelas:
    // Jika superadmin dan memilih adminId, gunakan itu; jika tidak, gunakan ID user yang login
    const targetAdminId = (session.user.role === 'superadmin' && adminId)
      ? adminId
      : session.user.id;

    // Cek duplikasi nama kelas di bawah dosen tersebut
    const existingClass = await prisma.class.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        adminId: targetAdminId,
      },
    });

    if (existingClass) {
      return errorResponse(`Kelas dengan nama "${name.trim()}" sudah terdaftar di akun Anda`, 400);
    }

    const newClass = await prisma.class.create({
      data: {
        name: name.trim(),
        level: level?.trim() || null,
        description: description?.trim() || null,
        subjectId: subjectId || null,
        adminId: targetAdminId,
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
        _count: {
          select: { exams: true, students: true },
        },
      },
    });

    return successResponse(newClass, 201);
  } catch (err) {
    console.error('Error creating class:', err);
    return errorResponse('Gagal membuat kelas', 500);
  }
}
