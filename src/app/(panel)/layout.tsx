import OrgNav from "@/components/org-nav";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrgNav />
      {children}
    </>
  );
}
