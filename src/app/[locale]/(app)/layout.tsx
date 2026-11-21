/**
 * Group for logged-in pages. The dashboard layout builds the header and the
 * role-based menu (see dashboard/layout.tsx); here only the page colour is set.
 */
export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return <div className="flex flex-1 flex-col bg-card">{children}</div>;
}
