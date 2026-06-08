import { Check } from 'lucide-react';

const steps = ['Choose Lot', 'Fill Details', 'Upload Receipt / Pay', 'Create Account', 'Wait for Approval'];

export default function ReservationProgressSteps({ currentStep = 1 }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <ol className="flex min-w-[680px] items-center">
        {steps.map((step, index) => {
          const number = index + 1;
          const complete = number < currentStep;
          const active = number === currentStep;
          return (
            <li key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                  complete || active ? 'bg-emerald-600 text-white' : 'bg-[#f1f5f9] text-[#64748b]'
                }`}>
                  {complete ? <Check className="h-4 w-4" /> : number}
                </span>
                <span className={`whitespace-nowrap text-xs font-bold ${active ? 'text-emerald-700' : 'text-[#64748b]'}`}>
                  {step}
                </span>
              </div>
              {number < steps.length && <span className="mx-3 h-px flex-1 bg-[#e2e8f0]" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
