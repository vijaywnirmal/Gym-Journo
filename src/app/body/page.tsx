import Link from "next/link";
import { getBodyMeasurements } from "@/lib/queries";
import BodyMeasurementsSection from "./BodyMeasurementsSection";

export default async function BodyPage() {
  const measurements = await getBodyMeasurements();

  return (
    <main className="px-4 pt-6">
      <Link href="/profile" className="mb-1 inline-block text-sm text-neutral-500">
        ← Profile
      </Link>
      <h1 className="mb-4 text-xl font-bold">Body & Progress</h1>
      <h2 className="mb-2 text-sm font-semibold text-neutral-200">Weight</h2>
      <BodyMeasurementsSection measurements={measurements} />
    </main>
  );
}
