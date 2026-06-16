import re

with open("my-app/app/Components/CrmLeadDetails/CompleteTaskModal.tsx", "r") as f:
    content = f.read()

# 1. Update PresalesCompleteTaskApiPayload
content = content.replace(
    "  lostReason?: string;\n};",
    "  lostReason?: string;\n  possessionDate?: string;\n};"
)

# 2. Add isHoldSubstageSelected
hook_insert = """  const selectedFeedbackOption = useMemo(
    () => feedbackOptions.find((m) => m.label === feedback),
    [feedback, feedbackOptions],
  );

  const isHoldSubstageSelected = useMemo(() => {
    if (!selectedFeedbackOption) return false;
    const subStage = selectedFeedbackOption.subStageName.trim();
    return (
      subStage === "Discovery Hold" ||
      subStage === "Connection Hold" ||
      subStage === "Experience & Design Hold" ||
      subStage === "Decision Hold" ||
      subStage.toLowerCase().includes("hold")
    );
  }, [selectedFeedbackOption]);"""
content = content.replace(
    "  const selectedFeedbackOption = useMemo(\n    () => feedbackOptions.find((m) => m.label === feedback),\n    [feedback, feedbackOptions],\n  );",
    hook_insert
)

# 3. Remove possessionDate from missingLeadPropertyGateFields
gate_fields = """    const effectivelyMissingFields = missingLeadPropertyGateFields({
      budget: modalBudget,
      propertyNotes: modalPropertyNotes,
      configuration: modalConfiguration,
      bookingType: modalBookingType,
      possessionDate: modalPossessionDate,
    });"""
new_gate_fields = """    const effectivelyMissingFields = missingLeadPropertyGateFields({
      budget: modalBudget,
      propertyNotes: modalPropertyNotes,
      configuration: modalConfiguration,
      bookingType: modalBookingType,
    } as any);"""
content = content.replace(gate_fields, new_gate_fields)

# 4. Add validation in handleSave
validation_insert = """    if (resoneMissing) {
      setApiError(
        "Reason (resone) is required for LOST or this closure substage.",
      );
      return;
    }

    if (isHoldSubstageSelected && !modalPossessionDate.trim()) {
      setApiError("Possession is required when placing a lead on hold.");
      return;
    }"""
content = content.replace("""    if (resoneMissing) {
      setApiError(
        "Reason (resone) is required for LOST or this closure substage.",
      );
      return;
    }""", validation_insert)

# 5. Add possessionDate to onPresalesApiComplete
presales_api_call = """        await onPresalesApiComplete({
          presalesMilestoneStage: stageToSave,
          presalesMilestoneCategory: catToSave,
          presalesMilestoneSubStage: substageToSave,
          feedback: substageToSave,
          note: note.trim(),
          nextCallDateLocal: nextCallDate,
          lostReason: reasonRequired ? lostReason.trim() : undefined,
        });"""
new_presales_api_call = """        await onPresalesApiComplete({
          presalesMilestoneStage: stageToSave,
          presalesMilestoneCategory: catToSave,
          presalesMilestoneSubStage: substageToSave,
          feedback: substageToSave,
          note: note.trim(),
          nextCallDateLocal: nextCallDate,
          lostReason: reasonRequired ? lostReason.trim() : undefined,
          possessionDate: isHoldSubstageSelected ? modalPossessionDate.trim() : undefined,
        });"""
content = content.replace(presales_api_call, new_presales_api_call)

# 6. Add possessionDate to onApiComplete correctly
api_call = """          possessionDate: needsLeadPropertyGate ? modalPossessionDate.trim() : undefined,"""
new_api_call = """          possessionDate: (needsLeadPropertyGate || isHoldSubstageSelected) ? modalPossessionDate.trim() : undefined,"""
content = content.replace(api_call, new_api_call)

# 7. Remove Possession from Connection popup
conn_popup = """                    <div>
                      <FieldLabel required>Possession</FieldLabel>
                      <Input
                        value={modalPossessionDate}
                        onChange={(e) => setModalPossessionDate(e.target.value)}
                        placeholder="Add possession..."
                        missing={showErrors && !modalPossessionDate.trim()}
                        className="h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px]"
                      />
                    </div>"""
content = content.replace(conn_popup, "")

# 8. Add Possession popup when isHoldSubstageSelected
hold_popup = """              {isHoldSubstageSelected ? (
                <div className="rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3.5 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 17c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-[13px] font-semibold text-[var(--crm-text-primary)]">
                      Possession Required for Hold
                    </p>
                  </div>
                  <p className="text-[11px] text-[var(--crm-text-muted)] leading-relaxed">
                    Please provide the possession details to place this lead on hold.
                  </p>
                  <div>
                    <FieldLabel required>Possession</FieldLabel>
                    <Input
                      value={modalPossessionDate}
                      onChange={(e) => setModalPossessionDate(e.target.value)}
                      placeholder="Add possession..."
                      missing={showErrors && !modalPossessionDate.trim()}
                      className="h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px]"
                    />
                  </div>
                </div>
              ) : null}"""
content = content.replace("{/* Conditional Property Fields (Budget, Property Notes, Configuration) */}", hold_popup + "\n\n              {/* Conditional Property Fields (Budget, Property Notes, Configuration) */}")

with open("my-app/app/Components/CrmLeadDetails/CompleteTaskModal.tsx", "w") as f:
    f.write(content)
