/** Clipboard copy with textarea fallback for modals that lose document focus after await. */
export async function copyTextToClipboard(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Nothing to copy");

  if (document.hasFocus() && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(trimmed);
      return;
    } catch {
      // fall through to textarea fallback
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = trimmed;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("Copy failed");
}
