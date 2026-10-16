"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { motion, useReducedMotion } from "framer-motion";
import { focusRing } from "./motion";

export function RowActionsMenu({
  customer,
  onView,
  onCancel,
}: {
  customer: string;
  onView: () => void;
  onCancel: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${customer}`}
          onClick={(event) => event.stopPropagation()}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E3E8EE] bg-white text-[16px] font-bold text-[#334155] hover:bg-[#F1F4F7] ${focusRing}`}
        >
          ⋯
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={`z-[70] min-w-[180px] origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-xl border border-[#E3E8EE] bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.08)] ${
            reduce ? "" : "data-[state=open]:animate-[meeting-menu-in_180ms_cubic-bezier(0.2,0.8,0.2,1)]"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <style>{`@keyframes meeting-menu-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`}</style>
          <MenuItem onSelect={onView}>View details</MenuItem>
          <MenuItem danger onSelect={onCancel}>
            Cancel
          </MenuItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({
  children,
  onSelect,
  danger,
}: {
  children: string;
  onSelect: () => void;
  danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={`group relative flex min-h-11 cursor-pointer items-center overflow-hidden rounded-lg px-3 text-[14px] font-semibold outline-none ${
        danger ? "text-[#B42318]" : "text-[#0F172A]"
      }`}
    >
      <motion.span
        aria-hidden
        className={`absolute inset-0 origin-left scale-x-0 ${danger ? "bg-[#FEF3F2]" : "bg-[#F1F4F7]"} group-hover:scale-x-100 group-data-[highlighted]:scale-x-100`}
        transition={{ duration: 0.18 }}
      />
      <span className="relative">{children}</span>
    </DropdownMenu.Item>
  );
}
