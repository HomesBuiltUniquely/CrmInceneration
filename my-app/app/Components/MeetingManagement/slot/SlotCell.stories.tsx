import type { SlotMeeting } from "@/lib/meeting-slot";

/**
 * Storybook is not installed in this app, so these are CSF-shaped fixtures.
 * Each story is one hour cell: 1, 2, 4, 5, and 20 meetings, plus missing data.
 */
const day = "2026-10-14";

function at(id: string, customer: string, extra: Partial<SlotMeeting> = {}): SlotMeeting {
  return {
    id,
    date: day,
    startMin: 16 * 60,
    customer,
    phone: "9900000000",
    meetingType: id.endsWith("v") ? "Virtual Meeting" : "Showroom Visit",
    designer: "Gulshi Ar.",
    value: 300000,
    status: "SCHEDULED",
    ...extra,
  };
}

export const OneMeeting = { args: { meetings: [at("1", "Gokul")] } };
export const TwoMeetings = { args: { meetings: [at("2a", "Anil"), at("2b", "Bina", { meetingType: "Virtual Meeting", status: "COMPLETED" })] } };
export const FourMeetings = {
  args: {
    meetings: ["Anil", "Bina", "Chitra", "Dev"].map((name, index) =>
      at(`4${index}`, name, { startMin: 16 * 60 + index * 10, status: index === 2 ? "IN PROGRESS" : "SCHEDULED" }),
    ),
  },
};
export const FiveMeetings = {
  args: {
    meetings: ["Anil", "Bina", "Chitra", "Dev", "Esha"].map((name, index) => at(`5${index}`, name, { startMin: 16 * 60 + index })),
  },
};
export const TwentyMeetings = {
  args: {
    meetings: Array.from({ length: 20 }, (_, index) => at(`t${index}`, `Customer ${index + 1}`, { startMin: 11 * 60 + index })),
  },
};
export const MissingData = {
  args: {
    meetings: [
      at("m1", "", { phone: "", meetingType: "", designer: "", value: 0, status: "" }),
      at("m2", "Only name", { phone: undefined, designer: "—", value: undefined, status: "RESCHEDULED", meetingType: "—" }),
    ],
  },
};

export const slotStories = { OneMeeting, TwoMeetings, FourMeetings, FiveMeetings, TwentyMeetings, MissingData };
