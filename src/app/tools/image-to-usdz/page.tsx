import ToolShell from '@/components/tools/ToolShell';
import ImageToUsdzTool from '@/components/tools/ImageToUsdzTool';

export default function ImageToUsdzPage() {
  return (
    <ToolShell title="画像 → USDZ（3Dの板）">
      <ImageToUsdzTool />
    </ToolShell>
  );
}
