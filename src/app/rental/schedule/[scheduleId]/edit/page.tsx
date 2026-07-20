import { RentalScheduleForm } from "../../../_components/RentalScheduleForm";

export default async function EditRentalSchedulePage({ params }: { params: Promise<{ scheduleId: string }> }) { const { scheduleId } = await params; return <RentalScheduleForm scheduleId={scheduleId} />; }
