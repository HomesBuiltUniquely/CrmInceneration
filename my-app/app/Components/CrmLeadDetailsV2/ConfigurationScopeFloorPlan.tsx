"use client";

import FloorPlanUpload from "@/app/Components/CrmLeadDetails/FloorPlanUpload";
import type { FloorPlanFileRef } from "@/lib/floor-plan";

type Props = {
  floorPlanS3Key: string;
  floorPlanPublicLink: string;
  floorPlanViewPath: string;
  floorPlanOpenPath: string;
  floorPlans?: FloorPlanFileRef[];
  uploading: boolean;
  removing?: boolean;
  onUpload: (files: File[]) => void | Promise<void>;
  onRemove?: (index: number) => void | Promise<void>;
  onRemoveAll?: () => void | Promise<void>;
  onError?: (message: string) => void;
};

export default function ConfigurationScopeFloorPlan({
  floorPlanS3Key,
  floorPlanPublicLink,
  floorPlanViewPath,
  floorPlanOpenPath,
  floorPlans,
  uploading,
  removing = false,
  onUpload,
  onRemove,
  onRemoveAll,
  onError,
}: Props) {
  const hasFloorPlan = Boolean(
    floorPlans?.length ||
      floorPlanS3Key.trim() ||
      floorPlanPublicLink.trim() ||
      floorPlanViewPath.trim(),
  );

  return (
    <FloorPlanUpload
      compact
      hideHeader
      hasFloorPlan={hasFloorPlan}
      floorPlanS3Key={floorPlanS3Key}
      files={floorPlans}
      publicLink={floorPlanPublicLink}
      viewHref={floorPlanViewPath}
      openHref={floorPlanOpenPath}
      canUpload
      uploading={uploading}
      removing={removing}
      onFileSelect={onUpload}
      onRemove={onRemove}
      onRemoveAll={onRemoveAll}
      onError={onError}
    />
  );
}
