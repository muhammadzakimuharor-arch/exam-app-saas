"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  ShieldCheck,
  GraduationCap,
  Loader2,
  Search,
  BookOpen,
  Calendar,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

interface LecturerItem {
  id: string;
  name: string;
  username: string;
  role: string;
  createdAt: string;
  _count: {
    classes: number;
  };
}

export default function ManageLecturersPage() {
  const { data: session } = useSession();
  const [lecturers, setLecturers] = useState<LecturerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal Tambah Dosen
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"dosen" | "superadmin">("dosen");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal Ganti Password
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState<LecturerItem | null>(null);
  const [updatedPassword, setUpdatedPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Modal Hapus Dosen
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingLecturer, setDeletingLecturer] = useState<LecturerItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLecturers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/lecturers");
      if (!res.ok) {
        if (res.status === 403) {
          toast.error("Hanya Super Admin yang berhak mengakses menu ini");
          return;
        }
        throw new Error("Gagal mengambil data dosen");
      }
      const data = await res.json();
      setLecturers(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Gagal memuat daftar dosen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLecturers();
  }, [fetchLecturers]);

  const handleOpenAddModal = () => {
    setNewName("");
    setNewUsername("");
    setNewPassword("");
    setNewRole("dosen");
    setShowPassword(false);
    setIsAddModalOpen(true);
  };

  const handleCreateLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim() || !newPassword.trim()) {
      toast.error("Nama lengkap, username, dan password wajib diisi");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/admin/lecturers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          username: newUsername.trim(),
          password: newPassword.trim(),
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambahkan dosen");

      toast.success(`Akun dosen "${newName.trim()}" berhasil dibuat`);
      setIsAddModalOpen(false);
      fetchLecturers();
    } catch (err: any) {
      toast.error(err.message || "Gagal menambahkan dosen");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPasswordModal = (lec: LecturerItem) => {
    setSelectedLecturer(lec);
    setUpdatedPassword("");
    setShowPassword(false);
    setIsPasswordModalOpen(true);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLecturer) return;
    if (!updatedPassword.trim() || updatedPassword.trim().length < 4) {
      toast.error("Password minimal 4 karakter");
      return;
    }

    try {
      setChangingPassword(true);
      const res = await fetch(`/api/admin/lecturers/${selectedLecturer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: updatedPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah password");

      toast.success(`Password untuk ${selectedLecturer.name} berhasil diperbarui`);
      setIsPasswordModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleOpenDeleteModal = (lec: LecturerItem) => {
    setDeletingLecturer(lec);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteLecturer = async () => {
    if (!deletingLecturer) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/lecturers/${deletingLecturer.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus dosen");

      toast.success(data.message || "Akun dosen berhasil dihapus");
      setIsDeleteModalOpen(false);
      fetchLecturers();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus dosen");
    } finally {
      setDeleting(false);
    }
  };

  // Cek otorisasi superadmin
  if (session && session.user?.role !== "superadmin") {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">
          Akses Khusus Super Admin
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Halaman pengelolaan akun pengajar hanya dapat dibuka oleh Super Admin (Pemilik Sistem).
        </p>
      </div>
    );
  }

  const filteredLecturers = lecturers.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary-50 text-primary-800 border border-primary-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Menu Super Admin
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Kelola Akun Dosen & Pengajar
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Sistem Multi-User Dosen: Buat akun pengajar agar setiap dosen memiliki ruangan terisolasi (&quot;1 Dosen 1 Pintu&quot;)
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Akun Dosen</span>
        </button>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama atau username dosen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Total Terdaftar: <span className="font-bold text-slate-800">{lecturers.length} Akun</span>
        </div>
      </div>

      {/* Lecturers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-7 h-7 animate-spin text-primary-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Memuat daftar akun dosen...</p>
          </div>
        ) : filteredLecturers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {search ? "Tidak ditemukan dosen yang cocok" : "Belum ada akun dosen terdaftar"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Klik tombol &quot;Tambah Akun Dosen&quot; di atas untuk mendaftarkan dosen baru.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Nama Lengkap & Role</th>
                  <th className="py-3.5 px-4">Username Login</th>
                  <th className="py-3.5 px-4 text-center">Jumlah Kelas</th>
                  <th className="py-3.5 px-4">Tanggal Dibuat</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLecturers.map((lec) => {
                  const isSelf = session?.user?.id === lec.id;
                  const isSuper = lec.role === "superadmin";

                  return (
                    <tr key={lec.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            isSuper ? "bg-amber-100 text-amber-800" : "bg-primary-100 text-primary-800"
                          }`}>
                            {lec.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{lec.name}</span>
                              {isSelf && (
                                <span className="text-[10px] font-semibold text-primary-700 bg-primary-50 px-1.5 py-0.2 rounded border border-primary-200">
                                  Anda
                                </span>
                              )}
                            </div>
                            <span className={`inline-block mt-0.5 text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded ${
                              isSuper ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-600"
                            }`}>
                              {isSuper ? "Super Admin" : "Dosen"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                        {lec.username}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                          <BookOpen className="w-3 h-3 text-slate-400" />
                          <span>{lec._count?.classes || 0} Kelas</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {new Date(lec.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPasswordModal(lec)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                            title="Ganti Password Dosen"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                            <span>Ganti Password</span>
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(lec)}
                              className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                              title="Hapus Akun Dosen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Dosen */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-800 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Tambah Akun Dosen Baru
                </h3>
                <p className="text-xs text-slate-500">
                  Dosen dapat login di /admin/login untuk mengelola kelasnya
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateLecturer} className="space-y-3.5 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Dosen <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dr. H. Ahmad Fauzi, M.Pd."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username Login <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: ahmad.fauzi (tanpa spasi)"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password Login <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Minimal 4 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hak Akses (Role)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "dosen" | "superadmin")}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-600"
                >
                  <option value="dosen">DOSEN (Hanya melihat & mengelola kelas sendiri)</option>
                  <option value="superadmin">SUPER ADMIN (Akses penuh ke semua dosen & kelas)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={saving}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-700 hover:bg-primary-800 disabled:bg-slate-300 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Akun Dosen</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ganti Password */}
      {isPasswordModalOpen && selectedLecturer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Ganti Password Dosen
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedLecturer.name} ({selectedLecturer.username})
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3.5 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password Baru <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Masukkan password baru"
                    value={updatedPassword}
                    onChange={(e) => setUpdatedPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={changingPassword}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-700 hover:bg-primary-800 disabled:bg-slate-300 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {changingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Perbarui Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hapus Dosen */}
      {isDeleteModalOpen && deletingLecturer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Konfirmasi Hapus Akun
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini tidak dapat dibatalkan
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun dosen{" "}
              <strong className="text-slate-900">{deletingLecturer.name}</strong>{" "}
              (<span className="font-mono">{deletingLecturer.username}</span>)?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deleting}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteLecturer}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Hapus Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
