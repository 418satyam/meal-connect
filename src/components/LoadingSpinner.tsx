import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 24, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2 className="text-green-600 animate-spin" style={{ width: size, height: size }} />
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  );
}
