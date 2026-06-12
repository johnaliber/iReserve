import { Check } from 'lucide-react';

const guestSteps = ['Choose Lot', 'Fill Details', 'Upload Receipt / Pay', 'Create Account', 'Wait for Approval'];
const customerSteps = ['Choose Lot', 'Confirm Details', 'Upload Receipt / Pay', 'Wait for Approval'];

export default function ReservationProgressSteps({ currentStep = 1, existingCustomer = false }) {
  const steps = existingCustomer ? customerSteps : guestSteps;

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <ol className={`flex items-center ${existingCustomer ? 'min-w-[560px]' : 'min-w-[680px]'}`}>
        {steps.map((step, index) => {
          const number = index + 1;
          const complete = number < currentStep;
          const active = number === currentStep;
          return (
            <li key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                  complete || active ? 'bg-emerald-700 !text-white' : 'bg-[#e2e8f0] text-[#334155]'
                }`}>
                  {complete ? <Check className="h-4 w-4" /> : number}
                </span>
                <span className={`whitespace-nowrap text-xs font-extrabold ${active ? 'text-emerald-800' : 'text-[#475569]'}`}>
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
