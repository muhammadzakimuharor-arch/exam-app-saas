import { prisma } from "@/lib/prisma";
import { requireAdmin, successResponse, errorResponse } from "@/lib/utils";

export async function GET() {
  try {
    const { error, session } = await requireAdmin();
    if (error || !session) return error;

    const isSuperAdmin = session.user.role === "superadmin";
    const currentAdminId = session.user.id;

    // Filter berdasarkan peran (Role Dosen vs Super Admin)
    const classWhere = isSuperAdmin ? {} : { adminId: currentAdminId };
    const studentWhere = isSuperAdmin ? {} : { class: { adminId: currentAdminId } };
    const activeExamWhere = isSuperAdmin
      ? { isActive: true }
      : { isActive: true, class: { adminId: currentAdminId } };
    const sessionWhere = isSuperAdmin
      ? { submittedAt: { not: null } }
      : { submittedAt: { not: null }, exam: { class: { adminId: currentAdminId } } };

    // Eksekusi paralel 100% via Promise.all untuk kecepatan loading maksimal
    const [
      subjectCount,
      classCount,
      studentCount,
      activeExamCount,
      sessionCount,
      activeExams,
      recentSubmissions,
    ] = await Promise.all([
      prisma.subject.count(),
      prisma.class.count({ where: classWhere }),
      prisma.student.count({ where: studentWhere }),
      prisma.exam.count({ where: activeExamWhere }),
      prisma.examSession.count({ where: sessionWhere }),
      prisma.exam.findMany({
        where: activeExamWhere,
        include: {
          class: {
            include: {
              subject: true,
              admin: {
                select: { id: true, name: true },
              },
            },
          },
          _count: {
            select: { sessions: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.examSession.findMany({
        where: sessionWhere,
        orderBy: { submittedAt: "desc" },
        take: 6,
        include: {
          exam: {
            include: {
              class: {
                include: {
                  subject: true,
                  admin: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    return successResponse({
      subjectCount,
      classCount,
      studentCount,
      activeExamCount,
      sessionCount,
      isSuperAdmin,
      activeExams: activeExams.map((exam: any) => ({
        id: exam.id,
        title: exam.title,
        classId: exam.class?.id || "",
        subjectId: exam.class?.subject?.id || "",
        className: exam.class?.name || "Kelas",
        lecturerName: exam.class?.admin?.name || null,
        subjectName: exam.subjectName || exam.class?.subject?.name || "Mata Kuliah Umum",
        sessionCount: exam._count.sessions,
        durationMinutes: exam.durationMinutes,
      })),
      recentSubmissions: recentSubmissions.map((s: any) => ({
        id: s.id,
        studentName: s.studentName,
        studentNim: s.studentNim,
        examTitle: s.exam?.title || "Ujian",
        subjectName: s.exam?.subjectName || s.exam?.class?.subject?.name || "Mata Kuliah Umum",
        className: s.exam?.class?.name || "Kelas",
        lecturerName: s.exam?.class?.admin?.name || null,
        submittedAt: s.submittedAt,
      })),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return errorResponse(message, 500);
  }
}
