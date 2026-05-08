import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import type { AllowUser } from "../types";

export function useAdminUsers() {
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserSchoolName, setNewUserSchoolName] = useState("");
  const [newUserTenantId, setNewUserTenantId] = useState("");
  const [newUserRole, setNewUserRole] = useState<AllowUser["role"]>("admin");
  const [newUserGovernorate, setNewUserGovernorate] = useState("");
  const [newUserEnabled, setNewUserEnabled] = useState(true);
  const [users, setUsers] = useState<AllowUser[]>([]);
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<AllowUser>>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    const qUsers = query(collection(db, "allowlist"), orderBy("updatedAt", "desc"), limit(400));
    const unsub = onSnapshot(
      qUsers,
      (snap) => setUsers(snap.docs.map((d) => ({ ...(d.data() as any), email: d.id })) as AllowUser[]),
      () => setUsers([])
    );
    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => [u.email, u.name, u.schoolName, u.tenantId, u.governorate, u.role].filter(Boolean).some((x) => String(x).toLowerCase().includes(s)));
  }, [search, users]);

  const setDraft = (email: string, patch: Partial<AllowUser>) => {
    const key = email.toLowerCase();
    setEditDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
  };
  const clearDraft = (email: string) => {
    const key = email.toLowerCase();
    setEditDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return {
    newUserEmail, setNewUserEmail,
    newUserName, setNewUserName,
    newUserSchoolName, setNewUserSchoolName,
    newUserTenantId, setNewUserTenantId,
    newUserRole, setNewUserRole,
    newUserGovernorate, setNewUserGovernorate,
    newUserEnabled, setNewUserEnabled,
    users,
    filteredUsers,
    editDrafts,
    setDraft,
    clearDraft,
    search, setSearch,
  };
}
