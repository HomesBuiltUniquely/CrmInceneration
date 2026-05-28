import RequireAuth from "../Components/RequireAuth";
import BookingTokenClient from "../Components/BookingToken/BookingTokenClient";

export const metadata = {
  title: "Booking & Token | Hows CRM",
  description: "Booking and token management dashboard",
};

export default function BookingTokenPage() {
  return (
    <RequireAuth>
      <BookingTokenClient />
    </RequireAuth>
  );
}
