import { AlertTriangle } from 'lucide-react';

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-red-50 p-4 text-red-500">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">Something went wrong</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
