import { getImportFormData } from "./actions";
import { ImportClient } from "./import-client";

export default async function CsvImportPage() {
  const formData = await getImportFormData();
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">CSVインポート</h1>
      <ImportClient formData={formData} />
    </div>
  );
}
