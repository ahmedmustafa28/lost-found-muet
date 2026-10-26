import { CLAIM_ERROR_MESSAGES, HANDOVER_SAFETY_TIPS } from "@/lib/constants";
import type { ClaimContact } from "@/lib/claims/queries";

type HandoverContactProps = {
  handoverNote: string | null;
  contact: ClaimContact;
  // Who the other person is, from the viewer's side.
  otherPersonLabel: string;
};

// Only rendered for the claimant and the report owner of an approved claim
// (DEVELOPMENT.md 6.5). The name and email come from get_claim_contact().
export function HandoverContact({ handoverNote, contact, otherPersonLabel }: HandoverContactProps) {
  return (
    <section className="flex flex-col gap-4 rounded-md border border-neutral-400 p-4">
      <h2 className="text-lg font-semibold">Arrange the handover</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {handoverNote && (
            <div className="flex flex-col gap-1">
              <h3 className="font-medium">Handover note</h3>
              <p className="whitespace-pre-line break-words">{handoverNote}</p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h3 className="font-medium">{otherPersonLabel}</h3>
            {contact.status === "loaded" ? (
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                <dt>Name</dt>
                <dd className="break-words">{contact.fullName}</dd>
                <dt>Email</dt>
                <dd className="break-all">
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="underline">
                      {contact.email}
                    </a>
                  ) : (
                    "Not available"
                  )}
                </dd>
              </dl>
            ) : (
              <p>{CLAIM_ERROR_MESSAGES.contactNotLoaded}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-medium">Stay safe</h3>
          <ul className="list-disc pl-5">
            {HANDOVER_SAFETY_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
