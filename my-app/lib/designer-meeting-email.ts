/** Design Module is the only source for designer emails on Hub meetings. */

export const DESIGNER_EMAIL_MISSING_CODE = "DESIGNER_EMAIL_MISSING";

export class DesignerEmailMissingError extends Error {
  readonly code = DESIGNER_EMAIL_MISSING_CODE;
  readonly designerName: string;

  constructor(designerName: string) {
    const name = designerName.trim() || "Selected designer";
    super(
      `Designer email is not added in Design Module for "${name}". Meeting was not scheduled.`,
    );
    this.name = "DesignerEmailMissingError";
    this.designerName = name;
  }
}

export function isDesignerEmailMissingError(error: unknown): error is DesignerEmailMissingError {
  if (error instanceof DesignerEmailMissingError) return true;
  if (error && typeof error === "object" && "code" in error) {
    return (error as { code?: string }).code === DESIGNER_EMAIL_MISSING_CODE;
  }
  return false;
}
