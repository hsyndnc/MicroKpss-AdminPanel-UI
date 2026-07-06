import { ExamDateCard } from "./_components/ExamDateCard";
import type { KpssType } from "@/lib/types";

const KPSS_TYPES: KpssType[] = ["Lisans", "Onlisans", "Ortaogretim"];

export default function ExamDatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sınav Tarihleri</h1>
        <p className="text-sm text-gray-500 mt-1">Her KPSS türü için sınav tarihini belirle</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {KPSS_TYPES.map((type) => <ExamDateCard key={type} kpssType={type} />)}
      </div>
    </div>
  );
}
