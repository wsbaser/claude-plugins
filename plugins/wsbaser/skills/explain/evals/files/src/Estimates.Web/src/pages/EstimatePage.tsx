import { useParams } from "react-router-dom";
import { useEstimate } from "../api/estimates";
import { EstimateEditor } from "../components/EstimateEditor";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/Spinner";
import { ErrorPanel } from "../components/ErrorPanel";

// Opened from the estimates list and from links shared in email and chat.
export function EstimatePage() {
  const { estimateId } = useParams<{ estimateId: string }>();
  const { data: estimate, error, isLoading, refetch } = useEstimate(estimateId!);

  if (isLoading) {
    return <Spinner label="Loading estimate" />;
  }

  if (error) {
    // Every failure lands here: 404, 403 (no estimate permission) and network errors
    // show the same panel. The status code is not read.
    return (
      <>
        <PageHeader title="Estimate" />
        <ErrorPanel message="Something went wrong while loading this estimate." onRetry={refetch} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Estimate ${estimate!.number}`} />
      <EstimateEditor estimate={estimate!} />
    </>
  );
}
