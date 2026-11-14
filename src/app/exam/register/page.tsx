"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  GraduationCap,
  ArrowLeft,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  Download,
  ArrowRight,
  User,
  ChevronDown,
  BookOpen,
  FolderOpen,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { loadImageAsDataUrl } from "@/lib/pdf-helpers";

interface AvailableExam {
  examId: string;
  examTitle: string;
  durationMinutes: number;
  minWords: number;
  totalQuestions: number;
  className: string;
  classId: string;
  subjectName: string;
  subjectLevel: string | null;
  lecturerName?: string | null;
  status: "belum" | "sedang_mengerjakan" | "selesai";
  sessionId?: string;
  startTime?: string | null;
  endTime?: string | null;
  scheduleState?: "open" | "upcoming" | "ended";
  scheduleMessage?: string | null;
}

function ExamRegisterContent() {
  const router = useRouter();

  // NIM lookup states
  const [nim, setNim] = useState("");
  const [checkingNim, setCheckingNim] = useState(false);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [verifiedNim, setVerifiedNim] = useState<string | null>(null);
  const [isAllowed, setIsAllowed] = useState(true);
  const [disallowReason, setDisallowReason] = useState<string | null>(null);
  const [availableExams, setAvailableExams] = useState<AvailableExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [startingSession, setStartingSession] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  // Dynamic branding
  const [instName, setInstName] = useState("IAI TABAH LAMONGAN");
  const [facName, setFacName] = useState("FTIK");
  const [instLogo, setInstLogo] = useState("/images/iai-tabah-logo.png");

  useEffect(() => {
    fetch("/api/settings/landing")
      .then((res) => res.json())
      .then((data) => {
        if (data?.setting) {
          if (data.setting.institutionName) setInstName(data.setting.institutionName);
          if (data.setting.facultyName) setFacName(data.setting.facultyName);
          if (data.setting.logoUrl) setInstLogo(data.setting.logoUrl);
        }
      })
      .catch(() => {});
  }, []);

  // Check NIM against database
  const handleCheckNim = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nim.trim()) {
      toast.error("Silakan masukkan NIM terlebih dahulu");
      return;
    }

    try {
      setCheckingNim(true);
      setStudentName(null);
      setVerifiedNim(null);
      setIsAllowed(true);
      setDisallowReason(null);
      setAvailableExams([]);
      setSelectedExamId("");

      const res = await fetch(`/api/exam/lookup?nim=${encodeURIComponent(nim.trim())}`);
      const data = await res.json();

      if (!res.ok || !data.found) {
        toast.error(
          data.message ||
            "NIM tidak terdaftar. Pastikan dosen telah memasukkan NIM Anda ke kelas."
        );
        return;
      }

      setStudentName(data.studentName);
      setVerifiedNim(data.studentNim);

      if (data.isAllowed === false) {
        setIsAllowed(false);
        setDisallowReason(data.message || "Kehadiran kurang dari batas minimum.");
        toast.error("Status ujian Anda ditangguhkan oleh dosen.");
        return;
      }

      setIsAllowed(true);
      const rawExams: AvailableExam[] = data.availableExams || [];
      setAvailableExams(rawExams);

      // Inisialisasi status buka/tutup accordion
      const initialOpen: Record<string, boolean> = {};
      rawExams.forEach((exam) => {
        const groupKey = `${exam.classId}__${exam.subjectName}__${exam.lecturerName || ""}`;
        if (initialOpen[groupKey] === undefined) {
          // Buka grup secara default agar tugas langsung terlihat
          initialOpen[groupKey] = true;
        }
      });
      setOpenGroups(initialOpen);

      if (rawExams.length > 0) {
        // Otomatis pilih tugas pertama yang belum selesai (atau tugas pertama)
        const firstUnfinished = rawExams.find((e) => e.status !== "selesai");
        setSelectedExamId(firstUnfinished ? firstUnfinished.examId : rawExams[0].examId);
      }

      toast.success(`Data mahasiswa ditemukan: ${data.studentName}`);
    } catch {
      toast.error("Terjadi masalah saat memverifikasi NIM");
    } finally {
      setCheckingNim(false);
    }
  };

  const selectedExam = availableExams.find((e) => e.examId === selectedExamId);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Grouping daftar tugas berdasarkan Mata Kuliah, Kelas, & Dosen Pengampu
  const groupedExams = availableExams.reduce((acc, exam) => {
    const key = `${exam.classId}__${exam.subjectName}__${exam.lecturerName || ""}`;
    if (!acc[key]) {
      acc[key] = {
        groupKey: key,
        subjectName: exam.subjectName,
        className: exam.className,
        classId: exam.classId,
        subjectLevel: exam.subjectLevel,
        lecturerName: exam.lecturerName || null,
        exams: [],
        totalCount: 0,
        activeCount: 0,
        completedCount: 0,
      };
    }
    acc[key].exams.push(exam);
    acc[key].totalCount++;
    if (exam.status === "selesai") {
      acc[key].completedCount++;
    } else {
      acc[key].activeCount++;
    }
    return acc;
  }, {} as Record<string, {
    groupKey: string;
    subjectName: string;
    className: string;
    classId: string;
    subjectLevel: string | null;
    lecturerName: string | null;
    exams: AvailableExam[];
    totalCount: number;
    activeCount: number;
    completedCount: number;
  }>);

  const groupsList = Object.values(groupedExams);

  // Start exam session
  const handleStartExam = async () => {
    if (!studentName || !verifiedNim || !selectedExam) return;

    if (selectedExam.status === "selesai") {
      toast.info("Anda sudah menyelesaikan penugasan ini.");
      return;
    }

    if (selectedExam.scheduleState === "upcoming") {
      toast.warning(selectedExam.scheduleMessage || "Ujian belum dibuka sesuai jadwal.");
      return;
    }

    if (selectedExam.scheduleState === "ended") {
      toast.error(selectedExam.scheduleMessage || "Waktu pelaksanaan ujian telah berakhir.");
      return;
    }

    try {
      setStartingSession(true);
      const res = await fetch("/api/exam/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName,
          studentNim: verifiedNim,
          examId: selectedExam.examId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal memulai sesi");
        return;
      }

      toast.success("Sesi ujian berhasil dibuka!");
      router.push(`/exam/${data.sessionId}`);
    } catch {
      toast.error("Terjadi gangguan jaringan");
    } finally {
      setStartingSession(false);
    }
  };

  // Download PDF if already submitted
  const handleDownloadExistingPDF = async (sessionId: string) => {
    if (downloadingPDF) return; // Mencegah spam klik
    setDownloadingPDF(true);
    const toastId = toast.loading("Sedang menyiapkan lembar jawaban PDF...");

    try {
      const res = await fetch(`/api/exam/${sessionId}/questions`);
      if (!res.ok) throw new Error("Gagal mengambil data jawaban");
      const data = await res.json();

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setFillColor(5, 150, 105);
      doc.rect(0, 0, 210, 24, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("LEMBAR JAWABAN TUGAS / UJIAN DIGITAL", 105, 11, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Portal Evaluasi Akademik Resmi", 105, 17, { align: "center" });

      const meta = [
        ["Nama Mahasiswa", `: ${data.studentName}`, "Judul Ujian", `: ${data.examTitle}`],
        ["NIM", `: ${data.studentNim}`, "Waktu Cetak", `: ${new Date().toLocaleString("id-ID")}`],
      ];

      autoTable(doc, {
        body: meta,
        startY: 28,
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 1.5, textColor: [40, 40, 40] },
      });

      let currentY = (doc as any).lastAutoTable.finalY + 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, currentY, 196, currentY);
      currentY += 6;

      for (let idx = 0; idx < data.questions.length; idx++) {
        const q = data.questions[idx];

        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }

        const isImg =
          q.answer?.fileUrl &&
          /\.(png|jpe?g|webp)$/i.test(q.answer.fileUrl.split("?")[0]);

        const fileNote = q.answer?.fileName
          ? isImg
            ? `\n\n[FILE LAMPIRAN TERVERIFIKASI]: ${q.answer.fileName} (Gambar dicetak di bawah)`
            : `\n\n[FILE LAMPIRAN]: ${q.answer.fileName}\nTautan: ${q.answer.fileUrl}`
          : "";

        const cellText = `Soal No. ${idx + 1} (${q.points} Poin)\n${q.text}\n\n[JAWABAN ANDA]:\n${
          q.answer?.answer || "(Tidak ada teks jawaban)"
        }${fileNote}`;

        autoTable(doc, {
          body: [[cellText]],
          startY: currentY,
          theme: "grid",
          styles: {
            fontSize: 9,
            cellPadding: 4,
            textColor: [30, 30, 30],
            overflow: "linebreak",
          },
        });

        currentY = (doc as any).lastAutoTable.finalY + 3;

        // Cetak gambar jika ada
        if (isImg && q.answer?.fileUrl) {
          const loadedImg = await loadImageAsDataUrl(q.answer.fileUrl);
          if (loadedImg) {
            const pdfW = Math.min(130, Math.max(70, (loadedImg.width * 25.4) / 150));
            const pdfH = (loadedImg.height / loadedImg.width) * pdfW;

            if (currentY + pdfH > 275) {
              doc.addPage();
              currentY = 20;
            }

            doc.setFontSize(8);
            doc.setTextColor(5, 150, 105);
            doc.text(
              `Pratinjau Gambar Lampiran Soal No. ${idx + 1} (${q.answer.fileName}):`,
              14,
              currentY + 2
            );
            currentY += 4;

            doc.addImage(
              loadedImg.dataUrl,
              loadedImg.format,
              14,
              currentY,
              pdfW,
              pdfH
            );
            currentY += pdfH + 6;
          }
        } else {
          currentY += 2;
        }
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Dokumen resmi Sistem Ujian Digital • Halaman ${i} dari ${pageCount}`,
          105,
          290,
          { align: "center" }
        );
      }

      doc.save(`Lembar_Jawaban_${data.studentNim}.pdf`);
      toast.dismiss(toastId);
      toast.success("Lembar jawaban PDF berhasil diunduh");
    } catch {
      toast.dismiss(toastId);
      toast.error("Gagal mengunduh file PDF");
    } finally {
      setDownloadingPDF(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Halaman Depan</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 p-1 flex items-center justify-center shrink-0">
              <Image
                src={instLogo}
                alt={`Logo ${instName}`}
                width={32}
                height={32}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black tracking-widest text-emerald-800 uppercase block leading-none">
                {instName}
              </span>
              <span className="text-[11px] font-semibold text-slate-600 block mt-0.5 max-w-[180px] truncate">
                {facName}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="h-2 bg-emerald-700 w-full" />

          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Verifikasi Identitas Mahasiswa
                </h2>
                <p className="text-xs text-slate-500">
                  Cukup masukkan NIM Anda untuk memuat nama dan paket ujian yang ditugaskan
                </p>
              </div>
            </div>

            {/* Step 1: Input NIM */}
            <form onSubmit={handleCheckNim} className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nomor Induk Mahasiswa (NIM) <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Masukkan NIM Anda (contoh: 2101001)"
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={checkingNim || !nim.trim()}
                  className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-xs cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  {checkingNim ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>Cek NIM</span>
                </button>
              </div>
            </form>

            {/* Step 2: Auto-Filled Profile & Available Exams / Disallowed notice */}
            {studentName && verifiedNim && !isAllowed && (
              <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
                      Status Ujian Ditangguhkan
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">
                      {studentName} ({verifiedNim})
                    </h3>
                    <p className="text-xs text-rose-700 mt-1">
                      {disallowReason || "Kehadiran Anda tidak mencukupi batas minimum untuk mengikuti ujian pada kelas ini."}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Silakan hubungi dosen pengampu mata kuliah untuk konfirmasi presensi atau pengurusan dispensasi.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {studentName && verifiedNim && isAllowed && (
              <div className="p-5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-4 animate-in fade-in duration-200">
                {/* Profile Box */}
                <div className="flex items-start justify-between pb-3 border-b border-emerald-200/80">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Mahasiswa Terverifikasi
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                      {studentName}
                    </h3>
                    <p className="text-xs font-mono text-slate-600">
                      NIM: {verifiedNim}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-full border border-emerald-300 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Terdaftar di Kelas</span>
                  </span>
                </div>

                {/* Exams List Grouped by Subject & Class in Dropdown / Accordion Cards */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Daftar Penugasan per Mata Kuliah & Kelas:
                    </label>
                    {groupsList.length > 0 && (
                      <span className="text-[11px] text-slate-500 font-medium">
                        {groupsList.length} Mata Kuliah Terdaftar
                      </span>
                    )}
                  </div>

                  {availableExams.length === 0 ? (
                    <div className="p-3.5 rounded-lg bg-white border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>Belum ada penugasan atau ujian yang berstatus aktif di kelas Anda.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groupsList.map((group) => {
                        const isOpen = openGroups[group.groupKey] ?? true;

                        return (
                          <div
                            key={group.groupKey}
                            className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                          >
                            {/* Card Header (Accordion Toggle) */}
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.groupKey)}
                              className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 transition-colors text-left cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                                  <BookOpen className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  {/* Badge Dosen Pengampu & Kelas */}
                                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-800 text-white shadow-2xs">
                                      <User className="w-3 h-3" />
                                      <span>Dosen: {group.lecturerName || "Pengajar Kelas"}</span>
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                      Kelas {group.className}
                                    </span>
                                    {group.subjectLevel && (
                                      <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                                        ({group.subjectLevel})
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                    {group.subjectName}
                                  </h4>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Terdapat <strong className="text-slate-700">{group.totalCount} tugas</strong> &bull; {group.completedCount} selesai &bull; {group.activeCount} belum dikerjakan
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0 ml-2">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-2xs ${
                                  group.activeCount > 0
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}>
                                  {group.totalCount} Tugas Tersedia
                                </span>
                                <ChevronDown
                                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                                    isOpen ? "rotate-180 text-emerald-700" : ""
                                  }`}
                                />
                              </div>
                            </button>

                            {/* Card Body (Butir-butir Tugas di Dalam Accordion) */}
                            {isOpen && (
                              <div className="p-3 sm:p-4 pt-1 sm:pt-1 border-t border-slate-100 space-y-2 bg-slate-50/40">
                                {group.exams.map((exam) => {
                                  const isSelected = exam.examId === selectedExamId;
                                  return (
                                    <div
                                      key={exam.examId}
                                      onClick={() => setSelectedExamId(exam.examId)}
                                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                                        isSelected
                                          ? "bg-white border-emerald-600 shadow-xs ring-2 ring-emerald-600/30"
                                          : "bg-white/90 border-slate-200 hover:bg-white hover:border-slate-300"
                                      }`}
                                    >
                                      {/* Radio selector icon */}
                                      <div className="mt-0.5 shrink-0">
                                        <div
                                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                            isSelected
                                              ? "border-emerald-600 bg-emerald-600"
                                              : "border-slate-300 bg-white"
                                          }`}
                                        >
                                          {isSelected && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                          )}
                                        </div>
                                      </div>

                                      {/* Exam Details */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                          {exam.status === "selesai" && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                              Sudah Selesai
                                            </span>
                                          )}
                                          {exam.status === "sedang_mengerjakan" && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                              Sedang Berjalan
                                            </span>
                                          )}
                                          {exam.status === "belum" && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                              Belum Dikerjakan
                                            </span>
                                          )}
                                          {exam.scheduleState === "upcoming" && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                              🕒 Belum Dibuka
                                            </span>
                                          )}
                                          {exam.scheduleState === "ended" && exam.status !== "selesai" && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                                              Ditutup
                                            </span>
                                          )}
                                          {exam.scheduleState === "open" && exam.startTime && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                              🟢 Sedang Aktif
                                            </span>
                                          )}
                                        </div>

                                        <h5 className="text-xs font-bold text-slate-900 leading-snug">
                                          {exam.examTitle}
                                        </h5>

                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                          Durasi: <span className="font-semibold text-slate-700">{exam.durationMinutes} Menit</span> &bull; {exam.totalQuestions} Soal
                                        </p>

                                        {exam.scheduleMessage && (
                                          <p
                                            className={`text-[10px] mt-1 font-medium ${
                                              exam.scheduleState === "upcoming"
                                                ? "text-amber-700"
                                                : exam.scheduleState === "ended"
                                                ? "text-slate-500"
                                                : "text-emerald-700"
                                            }`}
                                          >
                                            {exam.scheduleMessage}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Panel Info Tugas Terpilih & Action Buttons */}
                {selectedExam && (
                  <div className="pt-2 space-y-3">
                    <div className="p-3.5 rounded-xl bg-white border border-emerald-300 shadow-2xs">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                        Tugas yang Anda Pilih:
                      </span>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Dosen: {selectedExam.lecturerName || "Pengajar Kelas"}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {selectedExam.subjectName} &bull; Kelas {selectedExam.className}
                            </span>
                          </div>
                          <p className="text-xs text-emerald-900 font-semibold">
                            {selectedExam.examTitle} ({selectedExam.durationMinutes} Menit &bull; {selectedExam.totalQuestions} Soal)
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          selectedExam.status === "selesai"
                            ? "bg-emerald-100 text-emerald-800"
                            : selectedExam.status === "sedang_mengerjakan"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {selectedExam.status === "selesai"
                            ? "Sudah Selesai"
                            : selectedExam.status === "sedang_mengerjakan"
                            ? "Sedang Berjalan"
                            : "Belum Dikerjakan"}
                        </span>
                      </div>
                    </div>
                    {selectedExam.status === "selesai" ? (
                      <div className="space-y-2">
                        <div className="p-3 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-medium">
                          Anda telah mengumpulkan lembar jawaban untuk penugasan ini.
                        </div>
                        {selectedExam.sessionId && (
                          <button
                            type="button"
                            onClick={() => handleDownloadExistingPDF(selectedExam.sessionId!)}
                            disabled={downloadingPDF}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-xs cursor-pointer transition-colors"
                          >
                            {downloadingPDF ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Menyiapkan Berkas PDF...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" />
                                <span>Unduh Salinan Lembar Jawaban (PDF)</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : selectedExam.scheduleState === "upcoming" ? (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                        <div>
                          <p className="font-bold">Ujian Belum Dibuka</p>
                          <p className="text-[11px] text-amber-700 mt-0.5">{selectedExam.scheduleMessage}</p>
                        </div>
                      </div>
                    ) : selectedExam.scheduleState === "ended" ? (
                      <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                        <div>
                          <p className="font-bold">Waktu Ujian Telah Ditutup</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{selectedExam.scheduleMessage}</p>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartExam}
                        disabled={startingSession}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-md cursor-pointer transition-all active:scale-[0.99]"
                      >
                        {startingSession ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Menyiapkan Lembar Soal...</span>
                          </>
                        ) : (
                          <>
                            <span>
                              {selectedExam.status === "sedang_mengerjakan"
                                ? "Lanjutkan Pengerjaan Ujian"
                                : "Mulai Mengerjakan Ujian"}
                            </span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExamRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
          Memuat formulir ujian...
        </div>
      }
    >
      <ExamRegisterContent />
    </Suspense>
  );
}
