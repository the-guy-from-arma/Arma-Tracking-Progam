export type PolicySection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type PolicyContent = {
  plainLanguage: string;
  sections: PolicySection[];
  sources?: { label: string; url: string }[];
};

export const INITIAL_POLICIES: Array<{
  slug: string;
  title: string;
  summary: string;
  content: PolicyContent;
}> = [
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    summary: "Rules for accounts, coursework, submissions, service access, and disputes.",
    content: {
      plainLanguage: "Applicants must be 16 or older. Applicants age 16 or 17 require separate verified parent or guardian authorization. Everyone must protect their account and use the campus lawfully.",
      sections: [
        { heading: "Operators and agreement", paragraphs: ["Enfusion University is an online learning service jointly operated by Thunder Buddies Studios and Black Ridge Studios (together, the Operators). By creating or using an account, you agree to these Terms and the other mandatory policies listed in your acceptance receipt.", "The service provides structured learning, assessment, advising, sponsored-service records, faculty communications, and institutional completion records. It does not provide emergency, legal, medical, or financial services."] },
        { heading: "Eligibility and accounts", paragraphs: ["You must be at least 16 years old. An applicant age 16 or 17 may not be admitted until a parent or legal guardian separately authorizes participation and completes the university's adult identity-verification process. Applicants age 18 or older act for themselves. You must provide accurate application information, keep your password confidential, and promptly report suspected unauthorized access through the Policy Contact system.", "An address ending in @enfusionuniversity.edu is an internal campus identifier and website login. It is not an email mailbox and cannot receive external mail."], bullets: ["One person may not impersonate another or share credentials.", "Automated scraping, security testing without written permission, harassment, malware, and attempts to evade academic controls are prohibited.", "The Operators may suspend or close accounts for security, legal, academic-integrity, or material policy violations after appropriate review."] },
        { heading: "Student work and limited license", paragraphs: ["You retain ownership of original work you create. You grant the Operators a limited, nonexclusive license to store, process, privately display, assess, moderate, and preserve your submissions and to issue or verify institutional records. This license exists only to operate, secure, document, and improve the learning service.", "You may submit only material you have the right to use. Public Workshop, demonstration, documentation, and reference links remain subject to their own terms."] },
        { heading: "Availability, external services, and termination", paragraphs: ["The service is provided on an as-available basis. Features, courses, providers, and schedules may change. The Operators do not guarantee uninterrupted availability, error-free content, permanent storage of optional content, or continued availability of third-party links.", "Account closure ends online access and hides public credential visibility. Records identified in the Privacy Notice may be retained for academic, integrity, security, audit, and dispute purposes."] },
        { heading: "Disclaimers and responsibility", paragraphs: ["To the fullest extent permitted by law, the service and its content are provided without warranties of merchantability, fitness for a particular purpose, noninfringement, accreditation, employment outcome, or acceptance by another institution. You are responsible for validating instructions, code, licenses, and public releases.", "To the fullest extent permitted by law, the Operators are not liable for indirect, incidental, special, consequential, exemplary, or lost-data damages. Nothing in these Terms excludes rights or liability that cannot legally be excluded. You agree to indemnify the Operators against third-party claims caused by your unlawful content, infringement, or intentional misuse, subject to applicable law."] },
        { heading: "Disputes and governing law", paragraphs: ["Before filing an eligible claim, you must submit a Terms dispute notice through the Policy Contact system and allow 30 days for good-faith resolution. The notice must describe the parties, facts, requested resolution, and relevant records.", "New York law governs without regard to conflict-of-law rules. After the notice period, eligible proceedings may be brought in a state or federal court located in New York with jurisdiction. These Terms do not require arbitration and do not contain a class-action waiver."] },
      ],
    },
  },
  {
    slug: "bohemia-independence-ip",
    title: "Bohemia Interactive Independence and Intellectual Property Notice",
    summary: "Explains the university's independence and responsible use of third-party sources and game materials.",
    content: {
      plainLanguage: "Enfusion University is independent. Bohemia Interactive does not own, operate, sponsor, endorse, authorize, or accredit it.",
      sections: [
        { heading: "No affiliation or endorsement", paragraphs: ["Enfusion University, Thunder Buddies Studios, and Black Ridge Studios are not owned, operated, authorized, endorsed, accredited, or sponsored by Bohemia Interactive a.s. or its affiliates. Course references do not imply a partnership or approval.", "Arma, Arma Reforger, Enfusion, Workbench, Bohemia Interactive, related logos, game content, documentation, and trademarks belong to their respective owners. The university does not use Bohemia logos or claim Bohemia visual trade dress as its identity."] },
        { heading: "Community Wiki use", paragraphs: ["The Bohemia Interactive Community Wiki is an attributed third-party technical source. The university creates original instructional explanations, pacing, labs, quizzes, rubrics, and assessments and links to relevant source pages rather than republishing complete articles.", "A citation or synchronized excerpt may be incomplete, outdated, redirected, or unavailable. The curriculum source system records revisions and warnings; students should consult the linked source and applicable official tools documentation."] },
        { heading: "Student projects and licenses", paragraphs: ["Students remain responsible for the Arma Reforger and Workbench license terms, Workshop rules, game licenses, asset licenses, public licenses, and third-party intellectual property used in their projects."], bullets: ["Do not suggest that Bohemia endorses a project or credential.", "Do not upload or redistribute assets, code, marks, or documentation without permission.", "Confirm the license for every imported asset and public release.", "Remove or correct infringing public evidence when notified."] },
      ],
      sources: [
        { label: "Bohemia Arma Public License", url: "https://www.bohemia.net/community/licenses/arma-public-license" },
        { label: "Bohemia Interactive Community Wiki general disclaimer", url: "https://community.bohemia.net/wiki/Bohemia_Interactive_Community%3AGeneral_disclaimer" },
      ],
    },
  },
  {
    slug: "sponsored-value-no-debt",
    title: "Sponsored Value, Ledger, and No-Debt Disclosure",
    summary: "Defines every displayed dollar figure as noncash statistical learning-service tracking.",
    content: {
      plainLanguage: "Your responsibility is always $0.00. Campus balances are internal statistics, not money, tuition, aid, loans, refunds, or debt.",
      sections: [
        { heading: "What displayed values mean", paragraphs: ["Sponsored Education Value, grants, awards, allocations, balances, returns, renewals, penalties, and restored balances are internal statistical measurements used to plan learning services, track progress, and produce institutional reports.", "These values are not tuition, payment, financial aid, federal aid, a loan, wages, cash, stored value, a scholarship payment, a tax-deductible donation, or a legally collectible balance. They cannot be withdrawn, transferred, redeemed, or exchanged."] },
        { heading: "No student debt", paragraphs: ["Student Responsibility remains $0.00. The university does not request payment information and creates no promissory note, interest, late fee, collection activity, credit reporting, refund entitlement, or student debt.", "Course allocations and withdrawal returns affect only internal learning-service statistics. A policy-based reduction does not create a bill or personal financial obligation."] },
        { heading: "No market or college-equivalency claim", paragraphs: ["Displayed values do not prove that a service is equivalent to college tuition, a college course, transferable credit, or a market price. They are not appraisals and should not be used for tax, lending, employment, or financial-aid purposes."] },
      ],
    },
  },
  {
    slug: "ai-automated-systems",
    title: "AI and Automated Academic Systems Notice",
    summary: "Explains automated grading, advising, faculty messaging, programming support, limitations, data use, and review.",
    content: {
      plainLanguage: "Many academic interactions are automated. They can be useful but may be wrong. Human review is limited and is not immediate support.",
      sections: [
        { heading: "Where automated systems are used", paragraphs: ["Google Gemini and university automation may support grading, regrading, advising, course recommendations, programming guidance, faculty messaging, outreach, source analysis, and administrative triage. Some named faculty and advisor identities are university-managed automated academic personas rather than live individuals.", "Ordinary campus screens use academic titles to provide a coherent learning experience. Those titles do not promise that a live person wrote or reviewed each message."] },
        { heading: "Information processed", paragraphs: ["Relevant assignment text, approved public links, course context, approved Wiki excerpts, rubric data, academic progress, program status, and relevant conversation history may be processed to provide these services.", "Passwords, authentication secrets, recovery credentials, unrelated private information, and raw internal audit logs are excluded from model prompts. Public links and student text are treated as untrusted content and cannot change system instructions."] },
        { heading: "Limits and verification", paragraphs: ["Generated code, citations, grading explanations, or recommendations may be inaccurate, incomplete, biased, inconsistent, unexpected, or unavailable. An automated system cannot prove that an unpublished mod runs correctly. Students must inspect, test, and license-check generated programming guidance before using or publishing it.", "Provider outages, safety controls, misuse protection, context limits, and university fair-use controls may delay or restrict access. There is no visible student token quota and no guarantee of an immediate answer."] },
        { heading: "Grading and review", paragraphs: ["Automated grading uses the assignment rubric, versioned approved course sources, accessible public evidence, citation validation, integrity checks, and a confidence threshold. A result finalizes automatically only when required validation passes."], bullets: ["Low confidence, conflicting sources, inaccessible evidence, suspected prompt injection, integrity flags, and credential-completing decisions enter an exception queue.", "Students may use one guided resubmission and one appeal.", "Integrity flags are not by themselves a misconduct finding.", "Human interaction is generally limited to exceptions, appeals, credential-completing decisions, safety concerns, owner intervention, and issues the system cannot confidently resolve."] },
        { heading: "Provider data mode", paragraphs: ["Until the owner records and publishes a paid-service configuration, the university classifies Gemini use as UNCONFIRMED_OR_UNPAID. Under the conservative disclosure for that mode, submitted content may be used by Google to improve services and may receive human review under Google's applicable terms.", "The service is not an emergency channel and does not provide legal, medical, or mental-health crisis advice. There is no guaranteed live office-hour or immediate human response."] },
        { heading: "Age and guardian verification", paragraphs: ["The identity provider used for guardian verification is separate from Gemini. Government-ID evidence, selfies, document numbers, and identity-provider images are not sent to Gemini or used for academic scoring.", "The university receives and retains a limited consent record, provider reference, adult-verification result, name-match result, status, timestamps, and audit history. An alternative verification route is available when a hosted document check is inaccessible or inappropriate."] },
      ],
      sources: [
        { label: "Gemini API Additional Terms of Service", url: "https://ai.google.dev/gemini-api/terms" },
        { label: "Gemini safety guidance", url: "https://ai.google.dev/gemini-api/docs/safety-guidance" },
      ],
    },
  },
  {
    slug: "privacy-student-data",
    title: "Privacy and Student Data Notice",
    summary: "Describes information collected, uses, providers, retention, security, and student requests.",
    content: {
      plainLanguage: "The university uses account and learning records to run the campus. It does not sell student information.",
      sections: [
        { heading: "Information collected", paragraphs: ["The university collects account and application data, including date of birth; academic goals and progress; enrollments; ledger statistics; submissions and public evidence links; grades and appeals; faculty messages; policy signatures and inquiries; device, session, and technical data; and security and audit records. For a 16- or 17-year-old applicant it also collects the guardian's name, email, relationship, consent statements, typed signature, provider session reference, verification status, adult and name-match results, and limited audit metadata."] },
        { heading: "How information is used", paragraphs: ["Information is used for authentication, education delivery, personalization, assessment, credentials, academic integrity, security, compliance, recordkeeping, support, policy enforcement, and dispute handling. Student information is not sold."] },
        { heading: "Providers and public information", paragraphs: ["Railway, database infrastructure, Google Gemini, Stripe Identity when enabled, and services behind student-provided external links may act as service providers or subprocessors as applicable. Their handling is governed by contracts and applicable terms.", "Guardian government-ID images, ID numbers, and live-selfie images remain with the hosted identity provider and are not copied into the university database. The university stores only the minimized result and audit fields described above. A guardian may request an alternative route, challenge an inaccurate result, or ask a privacy question through the Policy Contact system.", "A credential is public only when its visibility is enabled. Student-provided Workshop, demo, portfolio, and reference links may already be public and are governed by the external service."] },
        { heading: "Requests, closure, and retention", paragraphs: ["Students may request access, correction, a policy response, account closure, or rights available in their jurisdiction through the Policy Contact system. Account closure disables campus access and hides public credential pages.", "Optional profile and conversation content is deleted where permitted. Consent, academic, ledger, integrity, credential, and audit records are retained for seven years to preserve institutional records, resolve disputes, prevent fraud, and document compliance, unless a longer period is legally required."] },
        { heading: "Security", paragraphs: ["The university uses access controls, server-side secrets, password hashing, session protections, audit records, data minimization, and restricted administrative tools. No security program can promise absolute protection, and students should not submit secrets or unnecessary private information."] },
      ],
    },
  },
  {
    slug: "academic-integrity-appeals",
    title: "Academic Integrity, Assessment, and Appeals Policy",
    summary: "Sets original-work, citation, generated-code, assessment, resubmission, and appeal expectations.",
    content: {
      plainLanguage: "Submit honest evidence, cite sources and collaborators, validate generated code, and use the documented resubmission and appeal process.",
      sections: [
        { heading: "Academic work", paragraphs: ["Students must submit original work or clearly identify authorized collaboration, reused material, generated code, tutorials, assets, and sources. Collaboration is allowed only within the assignment's boundaries.", "Plagiarism, fabricated progress, falsified public evidence, credential sharing, inaccessible evidence intentionally presented as proof, cheating, and prompt injection intended to manipulate an assessor are prohibited."] },
        { heading: "Generated code and assistance", paragraphs: ["Generated code may be used when the assignment permits it, but the student remains responsible for understanding, testing, documenting, licensing, and accurately describing the result. Undisclosed generation may be treated as an integrity concern when independent work is required."] },
        { heading: "Assessment and sponsored-learning standing", paragraphs: ["Automated results are provisional until confidence, citations, evidence access, rubric validation, and integrity checks pass. Capstones, credential-completing exceptions, and integrity concerns receive human or owner review.", "Finalized grades may affect sponsored-learning continuation under the published standing rules. A lower standing changes only internal learning-service allocations and never creates debt."] },
        { heading: "Resubmission, appeal, and misconduct review", paragraphs: ["Students may inspect feedback, complete one guided resubmission, and submit one appeal. An appeal should identify the disputed rubric item, evidence, and requested correction.", "An automated integrity flag cannot by itself establish misconduct. The student receives notice and an opportunity to provide context before an adverse integrity decision is finalized."] },
      ],
    },
  },
  {
    slug: "credentials-institutional-status",
    title: "Credentials, Programs, and Institutional Status",
    summary: "Explains independent, non-accredited status and the limits of completion records.",
    content: {
      plainLanguage: "Completion records document work inside this independent, non-accredited institution. Acceptance elsewhere is never guaranteed.",
      sections: [
        { heading: "Institutional status", paragraphs: ["Enfusion University is an independent, non-accredited online learning institution. It is not authorized to award accredited degrees and is not a college, university, licensing board, or governmental education provider for accreditation purposes."] },
        { heading: "Meaning of credentials", paragraphs: ["Completion records are private institutional credentials documenting requirements completed in this platform. They are not accredited degrees, professional licenses, regulated certifications, or guaranteed transferable college credit.", "Associate and bachelor wording remains disabled in public production unless the existing legal feature gate is affirmatively enabled after documented authority review."] },
        { heading: "No recognition guarantee", paragraphs: ["No employer, college, licensing board, government body, Arma community organization, or Bohemia Interactive recognition is promised. A recipient decides whether and how to consider a record. Students should verify acceptance before relying on a credential for employment, licensing, or transfer."] },
      ],
      sources: [{ label: "U.S. Department of Education accreditation guidance", url: "https://www.ed.gov/laws-and-policy/higher-education-laws-and-policy/college-accreditation/diploma-mills-and-accreditation" }],
    },
  },
  {
    slug: "electronic-records-signature",
    title: "Electronic Records and Signature Consent",
    summary: "Consent to electronic policies, signatures, records, notices, and retainable receipts.",
    content: {
      plainLanguage: "You agree to receive and sign campus records online and need a current browser, internet access, and a way to save or print HTML.",
      sections: [
        { heading: "Consent to electronic records", paragraphs: ["You consent to receive policies, notices, signatures, academic records, decisions, and receipts electronically. The service requires internet access, a current web browser, and the ability to save or print HTML documents.", "Before signing, you may open, print, or save every policy. The final review identifies titles, version numbers, effective dates, and checksums."] },
        { heading: "Electronic signature record", paragraphs: ["Typing the same legal or public name entered in the application, affirmatively selecting each acknowledgment, attesting to age, and selecting the intent-to-sign statement constitutes your electronic signature.", "The retainable record includes signer name, student or application tracking number, timestamp, exact policy versions, checksums, user agent, a salted hash of the originating IP address, and the electronic-consent statement. No drawn signature image or raw IP address is stored."] },
        { heading: "Separate guardian consent", paragraphs: ["A 16- or 17-year-old applicant signs the application policy bundle in their own name. The named parent or legal guardian receives a separate one-time record and must affirm parental responsibility, authorize participation, acknowledge the identity and privacy notice, type their own legal name, and complete adult identity verification before admission.", "Guardian consent and identity verification do not replace the student's own academic responsibilities. A guardian may withdraw authorization through the Policy Contact system; access and record consequences are evaluated under applicable law and the published Terms."] },
        { heading: "Withdrawal and paper copies", paragraphs: ["You may withdraw electronic consent through the Policy Contact system. Because Enfusion University is online-only, withdrawal closes online academic access after required record processing. Paper-copy requests will be handled through the same inquiry system where legally required."] },
      ],
      sources: [{ label: "FTC report on the E-SIGN consumer-consent provision", url: "https://www.ftc.gov/sites/default/files/documents/reports/report-congress-electronic-signatures-global-and-national-commerce-act-consumer-consent-provision/esignreport.pdf" }, { label: "UK ICO age-assurance guidance", url: "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/how-to-use-our-guidance-for-standard-one-best-interests-of-the-child/best-interests-framework/age-assurance/" }, { label: "Australian OAIC age-assurance privacy guidance", url: "https://www.oaic.gov.au/__data/assets/pdf_file/0017/262043/OAIC-privacy-guidance-on-age-assurance-technologies.pdf" }],
    },
  },
];
