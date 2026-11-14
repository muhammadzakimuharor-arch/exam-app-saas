import { requireAdmin, successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error;

  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');

    if (!examId) {
      return errorResponse('Parameter examId wajib diisi', 400);
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { class: true },
    });
    if (!exam) {
      return errorResponse('Ujian tidak ditemukan', 404);
    }

    // 1 Dosen 1 Pintu: Pastikan dosen hanya melihat jawaban dari ujian kelas miliknya
    if (session.user.role !== 'superadmin' && exam.class.adminId !== session.user.id) {
      return errorResponse('Akses ditolak: Anda tidak memiliki akses ke lembar jawaban ujian ini', 403);
    }

    const sessions = await prisma.examSession.findMany({
      where: { examId },
      include: {
        answers: {
          include: {
            question: {
              select: {
                id: true,
                text: true,
                order: true,
                points: true,
              },
            },
          },
          orderBy: {
            question: { order: 'asc' },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return successResponse(sessions);
  } catch (err) {
    console.error('Error fetching answers:', err);
    return errorResponse('Gagal mengambil data jawaban', 500);
  }
}

/**
 * Reset / Hapus sesi ujian mahasiswa
 * Berguna untuk pengujian atau jika mahasiswa laptopnya mati/berkendala dan diberi izin mengerjakan ulang
 */
export async function DELETE(request: Request) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error;

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return errorResponse('Parameter sessionId wajib disertakan', 400);
    }

    const examSession = await prisma.examSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        studentName: true,
        studentNim: true,
        exam: {
          include: { class: true },
        },
      },
    });

    if (!examSession) {
      return errorResponse('Sesi ujian tidak ditemukan', 404);
    }

    // 1 Dosen 1 Pintu: Cek izin menghapus/mereset sesi ujian
    if (session.user.role !== 'superadmin' && examSession.exam.class.adminId !== session.user.id) {
      return errorResponse('Akses ditolak: Anda tidak memiliki akses ke sesi ujian ini', 403);
    }

    // Delete session (answers will cascade delete)
    await prisma.examSession.delete({
      where: { id: sessionId },
    });

    return successResponse({
      message: `Sesi ujian mahasiswa ${examSession.studentName} (${examSession.studentNim}) berhasil direset`,
    });
  } catch (err) {
    console.error('Error deleting exam session:', err);
    return errorResponse('Gagal mereset sesi ujian', 500);
  }
}
