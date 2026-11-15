import ToolShell from '@/components/tools/ToolShell';

export default function UsdzToGlbPage() {
  return (
    <ToolShell title="USDZ → GLB コンバーター">
      {/* 元のコンバーターをそのまま組み込み（public/tools/usdz-to-glb.html） */}
      <iframe src="/tools/usdz-to-glb.html" title="USDZ → GLB コンバーター" className="h-full w-full border-0" />
    </ToolShell>
  );
}
