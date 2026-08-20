import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Alert } from "@/components/ui/primitives";
import { RequestForm } from "@/app/(app)/requests/request-form";
import type { Department, Shift } from "@/types/domain";

export const metadata: Metadata = { title: "Buat Request" };
export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const ctx = await requirePermission("request.create");
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();

  const [{ data: departments }, { data: shifts }, { data: rate }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, hotel_id, code, name, is_active, sort_order")
      .eq("hotel_id", hotel.id)
      .eq("is_active", true)
      .order("sort_order")
      .returns<Department[]>(),
    supabase
      .from("shifts")
      .select("id, hotel_id, code, name, start_time, end_time, break_minutes, is_active")
      .eq("hotel_id", hotel.id)
      .eq("is_active", true)
      .order("start_time")
      .returns<Shift[]>(),
    supabase
      .from("rate_master")
      .select("rate, overtime_rate, rate_type")
      .eq("hotel_id", hotel.id)
      .eq("is_active", true)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle<{ rate: number; overtime_rate: number; rate_type: "daily" | "hourly" }>(),
  ]);

  const departmentList = departments ?? [];

  return (
    <>
      <PageHeader
        title="Buat Casual Request"
        description={`Nomor request dibuat otomatis oleh sistem dengan format CRQ/${hotel.code}/TAHUN/BULAN/URUT.`}
      />

      {departmentList.length === 0 ? (
        <Alert tone="warning" title="Department belum tersedia">
          Unit hotel ini belum memiliki department aktif. Minta HR Admin atau Super Admin
          menambahkan department pada menu Pengaturan sebelum membuat request.
        </Alert>
      ) : (
        <RequestForm
          departments={departmentList}
          shifts={shifts ?? []}
          currency={hotel.currency}
          defaultDepartmentId={ctx.profile.department_id}
          rateHint={rate ?? null}
        />
      )}
    </>
  );
}
