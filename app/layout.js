import "./globals.css";

export const metadata = {
  title: "Porch",
  description: "Leave a note. Keep it, or pin it to the rail.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
