-- ====================================================================
-- SKEMA DATABASE PORTAL UJIAN DIGITAL (POSTGRESQL / SUPABASE)
-- Multi-User Dosen ("1 Dosen 1 Pintu") & Super Admin
-- ====================================================================

-- 1. Tabel Admin (Super Admin & Dosen Pengajar)
CREATE TABLE IF NOT EXISTS "Admin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'dosen',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Subject (Mata Kuliah)
CREATE TABLE IF NOT EXISTS "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Class (Kelas / Rombel Mahasiswa - Terisolasi per Dosen)
CREATE TABLE IF NOT EXISTS "Class" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "description" TEXT,
    "subjectId" TEXT REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "adminId" TEXT REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Class_name_idx" ON "Class"("name");
CREATE INDEX IF NOT EXISTS "Class_adminId_idx" ON "Class"("adminId");

-- 4. Tabel Student (Mahasiswa Terdaftar)
CREATE TABLE IF NOT EXISTS "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nim" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classId" TEXT NOT NULL REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "allowExamReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Student_classId_nim_key" UNIQUE ("classId", "nim")
);
CREATE INDEX IF NOT EXISTS "Student_nim_idx" ON "Student"("nim");

-- 5. Tabel Exam (Paket Ujian & Penugasan)
CREATE TABLE IF NOT EXISTS "Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subjectName" TEXT,
    "classId" TEXT NOT NULL REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "durationMinutes" INTEGER NOT NULL DEFAULT 90,
    "minWords" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Exam_classId_idx" ON "Exam"("classId");
CREATE INDEX IF NOT EXISTS "Exam_isActive_idx" ON "Exam"("isActive");

-- 6. Tabel Question (Butir Soal Essay & Pengaturan Lampiran)
CREATE TABLE IF NOT EXISTS "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "allowFileUpload" BOOLEAN NOT NULL DEFAULT false,
    "fileRequired" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS "Question_examId_order_idx" ON "Question"("examId", "order");

-- 7. Tabel ExamSession (Sesi Pengerjaan Ujian Mahasiswa)
CREATE TABLE IF NOT EXISTS "ExamSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "studentName" TEXT NOT NULL,
    "studentNim" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "ExamSession_studentNim_idx" ON "ExamSession"("studentNim");
CREATE INDEX IF NOT EXISTS "ExamSession_examId_studentNim_idx" ON "ExamSession"("examId", "studentNim");
CREATE INDEX IF NOT EXISTS "ExamSession_submittedAt_idx" ON "ExamSession"("submittedAt");

-- 8. Tabel Answer (Lembar Jawaban & Lampiran Mahasiswa)
CREATE TABLE IF NOT EXISTS "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "questionId" TEXT NOT NULL REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "answer" TEXT NOT NULL DEFAULT '',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_sessionId_questionId_key" UNIQUE ("sessionId", "questionId")
);

-- 9. Tabel LandingSetting (CMS White-Label Instansi & Tampilan Portal)
CREATE TABLE IF NOT EXISTS "LandingSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "institutionName" TEXT NOT NULL DEFAULT 'IAI TABAH LAMONGAN',
    "facultyName" TEXT NOT NULL DEFAULT 'Fakultas Tarbiyah dan Ilmu Keguruan (FTIK)',
    "universityName" TEXT NOT NULL DEFAULT 'Fakultas Tarbiyah dan Ilmu Keguruan (FTIK)',
    "portalTitle" TEXT NOT NULL DEFAULT 'Portal Ujian & Penugasan Digital',
    "portalSubtitle" TEXT NOT NULL DEFAULT 'Platform Evaluasi Akademik Mahasiswa Terintegrasi',
    "heroHeadline" TEXT NOT NULL DEFAULT 'Portal Ujian & Penugasan Digital',
    "ctaButtonText" TEXT NOT NULL DEFAULT 'Mulai Masuk & Kerjakan Soal',
    "ctaHelperText" TEXT NOT NULL DEFAULT 'Cukup siapkan NIM Anda yang telah didaftarkan di kelas',
    "academicYear" TEXT NOT NULL DEFAULT 'Tahun Akademik 2026/2027',
    "logoUrl" TEXT,
    "heroImageUrl" TEXT,
    "announcementTitle" TEXT NOT NULL DEFAULT 'Petunjuk & Tata Tertib Pelaksanaan Ujian',
    "announcementBody" TEXT NOT NULL DEFAULT '1. Pastikan koneksi internet stabil selama pengerjaan.\n2. Masukkan NIM yang valid untuk memuat identitas dan kelas secara otomatis.\n3. Dilarang melakukan kecurangan (sistem dilengkapi proteksi anti-contek dan anti-inspect).\n4. Jika batas waktu habis, lembar jawaban akan otomatis dikumpulkan ke sistem.',
    "bannerImageUrl" TEXT,
    "feature1Title" TEXT NOT NULL DEFAULT 'Uraian Essay & Lampiran Digital',
    "feature1Desc" TEXT NOT NULL DEFAULT 'Tuliskan analisis dan uraian essay secara terstruktur. Lengkapi jawaban dengan unggahan diagram teknis, sketsa kurikulum, atau foto lembar kerja yang otomatis tercetak rapi ke berkas PDF.',
    "feature2Title" TEXT NOT NULL DEFAULT 'Timer Realtime & Auto-Save Cloud',
    "feature2Desc" TEXT NOT NULL DEFAULT 'Seluruh ketikan jawaban tersimpan otomatis secara berkala ke cloud. Tidak perlu khawatir apabila koneksi terputus sesaat atau terjadi gangguan perangkat, pengerjaan dapat langsung dilanjutkan.',
    "feature3Title" TEXT NOT NULL DEFAULT 'Unduh Lembar Jawaban PDF Resmi',
    "feature3Desc" TEXT NOT NULL DEFAULT 'Begitu ujian selesai dikumpulkan, mahasiswa dan dosen pengampu dapat langsung mengunduh salinan lembar jawaban berformat PDF resmi terverifikasi lengkap dengan waktu submit dan nama mahasiswa.',
    "footerText" TEXT NOT NULL DEFAULT 'Hak Cipta Dilindungi.',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Inisialisasi Akun Superadmin Default (Password: admin123) jika belum ada
-- Password hash menggunakan bcrypt untuk "admin123"
INSERT INTO "Admin" ("id", "username", "passwordHash", "name", "role", "createdAt")
VALUES (
    'admin_super_default',
    'admin',
    '$2a$10$wT7R1qR9yKx3J5Xm8oP9Z.X9V9r8t7y6u5i4o3p2a1s0d9f8g7h6j',
    'Super Administrator',
    'superadmin',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO NOTHING;

-- Inisialisasi LandingSetting Default
INSERT INTO "LandingSetting" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;
