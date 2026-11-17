import { useState, useEffect } from "react";
import {
  initialLogs,
  initialReports,
  initialSettings,
  initialUsers,
  nowStamp,
  type LogEntry,
  type Report,
  type Role,
  type Settings,
  type Status,
  type User,
} from "./data";
import { Public } from "./components/Public";
import { Staff } from "./components/Staff";
import { Admin } from "./components/Admin";
import { Login } from "./components/Login";
import {
  fetchReports,
  fetchSettingsApi,
  fetchUsersApi,
  createUserApi,
  deleteUserApi,
  logoutApi,
  updateSettingsApi,
} from "./api";

export default function App() {
  const [view, setView] = useState<"public" | "login">("public");
  const [session, setSession] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);

  // Sinkronisasi data awal dari backend saat aplikasi dimuat
  useEffect(() => {
    fetchReports()
      .then((data) => {
        if (data.items && data.items.length > 0) {
          const apiMapped: Report[] = data.items.map((it) => ({
            id: it.id,
            street:
              it.location_source === "exif" ? "GPS Foto" : `Titik #${it.id}`,
            x: 50,
            y: 50,
            lat: it.latitude,
            lon: it.longitude,
            severity: it.max_severity,
            status: it.status,
            confidence: it.max_confidence,
            kind:
              (it.detections?.[0]?.class_name as "pothole" | "crack") ||
              "pothole",
            hidden: it.is_hidden,
            date: it.created_at.slice(0, 10),
            iso: it.created_at.slice(0, 10),
            img: it.image_url,
            annotated_img: it.annotated_image_url,
          }));
          // Gunakan data riil dari Supabase
          setReports(apiMapped);
        }
      })
      .catch((e) => console.log("Menggunakan data offline/seed:", e));

    fetchUsersApi()
      .then((data) => {
        if (data && data.length > 0) {
          setUsers(
            data.map((u: any) => ({
              id: u.id,
              username: u.username,
              password: "",
              fullName: u.full_name,
              role: u.role,
              active: u.is_active ?? true,
            })),
          );
        }
      })
      .catch(() => {});

    fetchSettingsApi()
      .then((s) => {
        setSettings({
          min: s.confidence_threshold_min ?? 0.25,
          publish: s.confidence_threshold_publish ?? 0.65,
          radius: s.proximity_radius_meters ?? 500,
        });
      })
      .catch(() => {});
  }, []);

  const log = (
    actor: string,
    action: string,
    target: string,
    details: string,
  ) =>
    setLogs((p) => [
      {
        id: Math.max(0, ...p.map((l) => l.id)) + 1,
        actor,
        action,
        target,
        details,
        at: nowStamp(),
      },
      ...p,
    ]);

  const add = (r: Report) => setReports((p) => [r, ...p]);

  const update = (
    id: number,
    patch: Partial<Report>,
    from: Status,
    hide: boolean,
  ) => {
    setReports((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    log(
      session?.username || "petugas",
      hide ? "HIDE_REPORT" : "STATUS_CHANGE",
      `reports #${id}`,
      hide ? "Ditandai false positive" : `${from} -> ${patch.status}`,
    );
  };

  const addUser = (u: {
    username: string;
    password: string;
    fullName: string;
    role: Role;
  }) => {
    if (!u.fullName.trim() || !u.username.trim() || u.password.length < 6)
      return "Isi semua kolom; kata sandi minimal 6 karakter.";
    if (users.some((x) => x.username === u.username.trim()))
      return "Username sudah dipakai.";
    const localId = Math.max(0, ...users.map((x) => x.id)) + 1;
    setUsers((p) => [
      ...p,
      { ...u, username: u.username.trim(), id: localId, active: true },
    ]);
    createUserApi(u)
      .then((created) => {
        if (created && created.id) {
          setUsers((p) =>
            p.map((x) =>
              x.username === u.username.trim() ? { ...x, id: created.id } : x,
            ),
          );
        }
      })
      .catch((e) => console.warn("Gagal sinkron user baru ke server:", e));
    log(
      session!.username,
      "CREATE_USER",
      "users",
      `Akun ${u.username.trim()} (${u.role}) dibuat`,
    );
    return null;
  };

  const toggleUser = (id: number) => {
    const t = users.find((x) => x.id === id)!;
    setUsers((p) =>
      p.map((x) => (x.id === id ? { ...x, active: !x.active } : x)),
    );
    log(
      session!.username,
      "TOGGLE_USER",
      "users",
      `${t.username} ${t.active ? "dinonaktifkan" : "diaktifkan"}`,
    );
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await deleteUserApi(id);
    } catch (e) {
      console.warn("Gagal menghapus user di server, hapus secara lokal:", e);
    }
    setUsers((p) => p.filter((x) => x.id !== id));
    if (session) {
      log(
        session.username,
        "DELETE_USER",
        "users",
        `Akun staf ID #${id} dihapus`,
      );
    }
  };

  const saveSettings = (s: Settings) => {
    setSettings(s);
    updateSettingsApi(s).catch(() => {});
    log(
      session!.username,
      "UPDATE_SETTING",
      "system_settings",
      `min ${s.min.toFixed(2)}, publish ${s.publish.toFixed(2)}, radius ${s.radius} m`,
    );
  };

  const logout = () => {
    logoutApi().catch(() => {});
    setSession(null);
    setView("public");
  };

  if (session?.role === "admin")
    return (
      <Admin
        user={session}
        users={users}
        reports={reports}
        settings={settings}
        logs={logs}
        update={update}
        addUser={addUser}
        toggleUser={toggleUser}
        deleteUser={handleDeleteUser}
        saveSettings={saveSettings}
        onLogout={logout}
      />
    );

  if (session)
    return (
      <Staff
        user={session}
        reports={reports}
        update={update}
        onLogout={logout}
      />
    );

  if (view === "login")
    return (
      <Login
        reports={reports}
        users={users}
        onBack={() => setView("public")}
        onSuccess={setSession}
      />
    );

  return (
    <Public
      reports={reports}
      settings={settings}
      onAdd={add}
      onLogin={() => setView("login")}
    />
  );
}
