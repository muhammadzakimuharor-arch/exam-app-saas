import { requireSuperAdmin, successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const createLecturerSchema = z.object({
  name: z.string().min(1, 'Nama lengkap wajib diisi'),
  username: z.string().min(3, 'Username minimal 3 karakter').regex(/^[a-zA-Z0-9_.-]+$/, 'Username hanya boleh huruf, angka, titik, strip atau underscore'),
  password: z.string().min(4, 'Password minimal 4 karakter'),
  role: z.enum(['dosen', 'superadmin']).optional().default('dosen'),
});

export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const lecturers = await prisma.admin.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        createdAt: true,
        _count: {
          select: { classes: true },
        },
      },
      orderBy: [
        { role: 'asc' }, // superadmin first or by name
        { name: 'asc' },
      ],
    });

    return successResponse(lecturers);
  } catch (err) {
    console.error('Error fetching lecturers:', err);
    return errorResponse('Gagal mengambil data dosen', 500);
  }
}

export async function POST(request: Request) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const validation = createLecturerSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message || 'Input tidak valid', 400);
    }

    const { name, username, password, role } = validation.data;
    const cleanUsername = username.trim().toLowerCase();

    const existingUser = await prisma.admin.findUnique({
      where: { username: cleanUsername },
    });

    if (existingUser) {
      return errorResponse(`Username "${cleanUsername}" sudah digunakan. Silakan gunakan username lain.`, 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newLecturer = await prisma.admin.create({
      data: {
        name: name.trim(),
        username: cleanUsername,
        passwordHash,
        role: role || 'dosen',
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    return successResponse(newLecturer, 201);
  } catch (err) {
    console.error('Error creating lecturer:', err);
    return errorResponse('Gagal menambahkan akun dosen', 500);
  }
}
