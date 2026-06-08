import FriendlyStatusBadge from './FriendlyStatusBadge';

export default function CustomerDocumentCard({ document, action }) {
  return (
    <article className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold text-[#272727]">{document.document_type}</h3>
            <FriendlyStatusBadge status={document.status} />
          </div>
          {document.rejection_reason && <p className="mt-2 text-sm text-rose-700">Please upload a clearer or correct document. {document.rejection_reason}</p>}
        </div>
        {action}
      </div>
    </article>
  );
}
