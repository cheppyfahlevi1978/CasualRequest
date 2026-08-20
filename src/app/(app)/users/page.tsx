import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hasAdminClient } from "@/lib/supabase/admin";
import {
  Alert,
  Avatar,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
} from "@/components/ui/primitives";
import { AddUserButton, UserFormModal, UserStatusToggle } from "@/app/(app)/users/user-form";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Department, Hotel, Profile, UserStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Pengguna" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<UserStatus, "success" | "warning" | "neutral" | "danger"> = {
  active: "success",
  pending: "warning",
  inactive: "neutral",
  suspended: "danger",
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  general_manager: "General Manager",
  finance: "Finance",
  hod: "Department Head",
  supervisor: "Supervisor",
  viewer: "Viewer",
  casual_worker: "Casual Worker",
};

export default async function UsersPage() {
  const ctx = await requirePermission("user.read");
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();
  const canManage = can(ctx, "user.manage");
  const isSuperAdmin = ctx.roles.includes("super_admin");

  const [{ data: profiles }, { data: departments }, { data: roleRows }, { data: hotelRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .is("deleted_at", null)
        .order("full_name")
        .limit(300)
        .returns<Profile[]>(),
      supabase
        .from("departments")
        .select("id, hotel_id, code, name, is_active, sort_order")
        .eq("hotel_id", hotel.id)
        .order("sort_order")
        .returns<Department[]>(),
      supabase
        .from("user_roles")
        .select("user_id, hotel_id, roles(code)")
        .limit(2000),
      supabase
        .from("user_hotels")
        .select("user_id, hotel_id")
        .limit(2000)
        .returns<{ user_id: string; hotel_id: string }[]>(),
    ]);

  type RoleRow = { user_id: string; hotel_id: string | null; roles: { code: string } | null };

  const rolesByUser = new Map<string, string>();
  for (const r of (roleRows ?? []) as unknown as RoleRow[]) {
    if (r.roles?.code && !rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, r.roles.code);
  }

  const hotelsByUser = new Map<string, string[]>();
  for (const r of hotelRows ?? []) {
    const list = hotelsByUser.get(r.user_id) ?? [];
    list.push(r.hotel_id);
    hotelsByUser.set(r.user_id, list);
  }

  const users = profiles ?? [];
  const serviceKey = hasAdminClient();

  const formProps = {
    hotels: ctx.hotels as Hotel[],
    departments: departments ?? [],
    isSuperAdmin,
    hasServiceKey: serviceKey,
  };

  return (
    <>
      <PageHeader
        title="Pengguna & Akses"
        description="Provisioning akun, role, dan pemetaan unit hotel. Akun Google yang belum terdaftar tidak otomatis mendapat akses."
        actions={canManage ? <AddUserButton {...formProps} trigger={null} /> : null}
      />

      {canManage && !serviceKey ? (
        <div className="mb-5">
          <Alert tone="warning" title="Pembuatan akun baru belum aktif">
            Set <code>SUPABASE_SERVICE_ROLE_KEY</code> pada environment server (Vercel) agar akun
            auth dapat dibuat dari aplikasi. Tanpa itu, akun harus dibuat dari dashboard Supabase
            lalu profilnya dilengkapi di sini.
          </Alert>
        </div>
      ) : null}

      {users.length === 0 ? (
        <Card>
          <EmptyState icon={<UserPlus size={26} />} title="Belum ada pengguna terdaftar" />
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Pengguna</Th>
                <Th>Role</Th>
                <Th>Jabatan</Th>
                <Th align="center">Unit Hotel</Th>
                <Th>Status</Th>
                <Th>Login Terakhir</Th>
                {canManage ? <Th align="right">Aksi</Th> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const roleCode = rolesByUser.get(u.id) ?? "viewer";
                const userHotels = hotelsByUser.get(u.id) ?? [];
                return (
                  <tr key={u.id} className="transition hover:bg-bg-subtle">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.full_name || u.email} size={34} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.full_name || "—"}</p>
                          <p className="truncate text-xs text-text-faint">{u.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={roleCode === "super_admin" ? "primary" : "info"}>
                        {ROLE_LABEL[roleCode] ?? roleCode}
                      </Badge>
                    </Td>
                    <Td className="text-xs">{u.position ?? "—"}</Td>
                    <Td align="center">{userHotels.length}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge>
                    </Td>
                    <Td className="text-xs">
                      {u.last_login_at ? formatDateTime(u.last_login_at) : "Belum pernah"}
                      <span className="block text-text-faint">
                        Dibuat {formatDate(u.created_at)}
                      </span>
                    </Td>
                    {canManage ? (
                      <Td align="right">
                        <div className="flex justify-end gap-2">
                          <UserFormModal
                            {...formProps}
                            existing={{
                              id: u.id,
                              full_name: u.full_name,
                              email: u.email,
                              phone: u.phone,
                              employee_id: u.employee_id,
                              position: u.position,
                              primary_hotel_id: u.primary_hotel_id,
                              department_id: u.department_id,
                              status: u.status,
                              role_code: roleCode,
                              hotel_ids: userHotels,
                            }}
                            trigger={
                              <span className="cursor-pointer text-xs font-medium text-primary hover:underline">
                                Edit
                              </span>
                            }
                          />
                          {u.id !== ctx.userId ? (
                            <UserStatusToggle userId={u.id} status={u.status} />
                          ) : null}
                        </div>
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
