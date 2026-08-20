import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState, Card, buttonClass } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <Card>
      <EmptyState
        icon={<FileQuestion size={28} />}
        title="Halaman atau data tidak ditemukan"
        description="Data mungkin sudah dihapus, atau berada di unit hotel lain yang tidak sedang aktif."
        action={
          <Link href="/dashboard" className={buttonClass("primary", "sm")}>
            Kembali ke Dashboard
          </Link>
        }
      />
    </Card>
  );
}
