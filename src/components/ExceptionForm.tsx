import { useState } from 'react';
import { reportDeliveryException } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { FileWarning } from 'lucide-react';
import type { ExceptionType } from '@/types';

const exceptionTypes: { value: ExceptionType; label: string }[] = [
  { value: 'restaurant_unavailable', label: 'Restaurant unavailable' },
  { value: 'ngo_unavailable', label: 'NGO unavailable' },
  { value: 'quantity_mismatch', label: 'Quantity mismatch' },
  { value: 'food_condition', label: 'Food condition issue' },
  { value: 'vehicle_problem', label: 'Volunteer vehicle problem' },
  { value: 'route_problem', label: 'Route problem' },
  { value: 'pickup_delayed', label: 'Pickup delayed' },
  { value: 'other', label: 'Other' },
];

interface Props {
  donationId: string;
  expectedQuantity?: number;
  unit?: string;
}

export function ExceptionForm({ donationId, expectedQuantity, unit }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ExceptionType>('quantity_mismatch');
  const [expected, setExpected] = useState(expectedQuantity?.toString() || '');
  const [actual, setActual] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast('Please provide a reason for the exception.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await reportDeliveryException(donationId, type, expected, actual, reason);
      toast('Exception reported. Relevant parties have been notified.', 'success');
      setOpen(false);
      setReason('');
      setActual('');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full rounded-lg border border-orange-200 px-4 py-2.5 text-sm font-semibold text-orange-600 hover:bg-orange-50"
      >
        <FileWarning className="h-4 w-4" /> Report Delivery Exception
      </button>

      <ConfirmModal
        open={open}
        title="Report Delivery Exception"
        confirmLabel={submitting ? 'Reporting...' : 'Submit Report'}
        onConfirm={handleSubmit}
        onCancel={() => setOpen(false)}
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Exception type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ExceptionType)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 outline-none"
            >
              {exceptionTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {type === 'quantity_mismatch' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Expected ({unit || 'units'})</label>
                <input
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Actual ({unit || 'units'})</label>
                <input
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-500">Reason (required)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Describe what happened..."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            />
          </div>
          {type === 'quantity_mismatch' && expected && actual && (
            <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-700">
              Difference: {Math.abs(Number(expected) - Number(actual))} {unit || 'units'}
            </div>
          )}
        </div>
      </ConfirmModal>
    </>
  );
}
