import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { NextResponse } from "next/server";
import {
  degrees,
  PDFDocument,
  PDFImage,
  PDFFont,
  PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { currentUser } from "@/lib/auth";
import { DOCUMENT_RENDERER_VERSION } from "@/lib/build-info";
import { db } from "@/lib/db";
import { policyGateResponse } from "@/lib/policies";

export const runtime = "nodejs";

const TYPES = new Set([
  "transcript",
  "enrollment-verification",
  "program-audit",
  "sponsored-learning-statement",
]);
const TITLES: Record<string, string> = {
  transcript: "Institutional Transcript",
  "enrollment-verification": "Enrollment Verification",
  "program-audit": "Academic Program Audit",
  "sponsored-learning-statement": "Sponsored-Learning Statement",
};
const FALLBACK_AUTHORITIES = {
  registrar: { name: "Dr. Theodore Wells", title: "University Registrar" },
  admissions: { name: "Dr. Marisol Grant", title: "Director of Admissions" },
  sponsored: {
    name: "Dana Mercer",
    title: "Director of Sponsored Learning",
  },
  dean: { name: "Dean Avery Bell", title: "Dean of Quality and Publishing" },
};
const navy = rgb(0.035, 0.12, 0.2);
const blue = rgb(0.08, 0.32, 0.46);
const gold = rgb(0.68, 0.52, 0.28);
const ink = rgb(0.09, 0.16, 0.23);
const muted = rgb(0.34, 0.43, 0.49);
const rule = rgb(0.75, 0.8, 0.82);
const paper = rgb(0.985, 0.98, 0.955);
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);

type Authority = { name: string; title: string };

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function GET(
  _: Request,
  context: { params: Promise<{ type: string }> },
) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const gate = await policyGateResponse(user.id);
  if (gate) return gate;
  const { type } = await context.params;
  if (!TYPES.has(type))
    return NextResponse.json(
      { error: "Unknown student document" },
      { status: 404 },
    );

  const [record, authorityProfiles] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        name: true,
        studentNumber: true,
        academicEmail: true,
        grantBalanceCents: true,
        courseEnrollments: {
          include: {
            course: {
              select: {
                code: true,
                title: true,
                learningCredits: true,
              },
            },
          },
          orderBy: { enrolledAt: "asc" },
        },
        programEnrollments: {
          include: {
            program: {
              select: {
                code: true,
                title: true,
                level: true,
                creditsRequired: true,
              },
            },
          },
          orderBy: { enrolledAt: "desc" },
        },
        certificates: {
          select: {
            title: true,
            credentialCode: true,
            issuedAt: true,
            learningCredits: true,
          },
        },
        grantLedger: {
          select: {
            type: true,
            description: true,
            amountCents: true,
            createdAt: true,
            runningBalanceCents: true,
          },
          orderBy: { createdAt: "desc" },
          take: 80,
        },
      },
    }),
    db.facultyProfile.findMany({
      where: {
        slug: {
          in: ["theodore-wells", "marisol-grant", "dana-mercer", "avery-bell"],
        },
      },
      select: { slug: true, name: true, title: true },
    }),
  ]);

  const profile = (slug: string, fallback: Authority): Authority => {
    const found = authorityProfiles.find((item) => item.slug === slug);
    return found ? { name: found.name, title: found.title } : fallback;
  };
  const authorities = {
    registrar: profile("theodore-wells", FALLBACK_AUTHORITIES.registrar),
    admissions: profile("marisol-grant", FALLBACK_AUTHORITIES.admissions),
    sponsored: profile("dana-mercer", FALLBACK_AUTHORITIES.sponsored),
    dean: profile("avery-bell", FALLBACK_AUTHORITIES.dean),
  };

  const issuedAt = new Date();
  const documentId = crypto.randomUUID().toUpperCase();
  const verificationCode = createHash("sha256")
    .update(`${documentId}:${user.id}:${issuedAt.toISOString()}:${type}`)
    .digest("hex")
    .toUpperCase()
    .slice(0, 24);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Enscript University - ${TITLES[type]}`);
  pdf.setAuthor("Enscript University Office of Academic Records");
  pdf.setSubject(`Private institutional record ${documentId}`);
  pdf.setKeywords([
    "Enscript University",
    "institutional record",
    type,
    documentId,
  ]);
  pdf.setCreationDate(issuedAt);
  pdf.setModificationDate(issuedAt);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  let signatureFont = serifItalic;
  try {
    signatureFont = await pdf.embedFont(
      await readFile(
        path.join(
          process.cwd(),
          "node_modules",
          "@fontsource",
          "allura",
          "files",
          "allura-latin-400-normal.woff",
        ),
      ),
      { subset: true },
    );
  } catch {
    signatureFont = serifItalic;
  }
  let logo: PDFImage | null = null;
  try {
    logo = await pdf.embedPng(
      await readFile(
        path.join(process.cwd(), "public", "enscript-university-lockup.png"),
      ),
    );
  } catch {
    logo = null;
  }

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;
  const addPage = () => {
    page = pdf.addPage([612, 792]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: paper });
    page.drawRectangle({ x: 0, y: 692, width: 612, height: 100, color: navy });
    page.drawRectangle({ x: 0, y: 686, width: 612, height: 6, color: gold });
    if (logo) {
      page.drawImage(logo, { x: 42, y: 704, width: 220, height: 88 });
      page.drawImage(logo, {
        x: 72,
        y: 300,
        width: 468,
        height: 187,
        opacity: 0.055,
        rotate: degrees(-10),
      });
    } else {
      page.drawText("ENSCRIPT UNIVERSITY", {
        x: 48,
        y: 747,
        size: 18,
        font: bold,
        color: paper,
      });
      page.drawText("ENSCRIPT UNIVERSITY", {
        x: 92,
        y: 370,
        size: 38,
        font: serifBold,
        color: navy,
        opacity: 0.055,
        rotate: degrees(-10),
      });
    }
    page.drawText("AUTHORIZED STUDENT COPY - CONTROLLED INSTITUTIONAL RECORD", {
      x: 102,
      y: 304,
      size: 8.5,
      font: bold,
      color: gold,
      opacity: 0.14,
      rotate: degrees(-10),
    });
    page.drawText("CONTROLLED DIGITAL RECORD", {
      x: 564 - bold.widthOfTextAtSize("CONTROLLED DIGITAL RECORD", 6.3),
      y: 755,
      size: 6.3,
      font: bold,
      color: gold,
    });
    page.drawText(documentId.slice(0, 18), {
      x: 564 - regular.widthOfTextAtSize(documentId.slice(0, 18), 5.8),
      y: 741,
      size: 5.8,
      font: regular,
      color: rgb(0.72, 0.8, 0.84),
    });
    page.drawText("O F F I C E   O F   A C A D E M I C   R E C O R D S", {
      x: 48,
      y: 701,
      size: 6.5,
      font: bold,
      color: rgb(0.75, 0.84, 0.87),
    });
    y = 650;
  };
  const ensure = (height: number) => {
    if (y - height < 105) addPage();
  };
  const text = (
    value: string,
    options: {
      size?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      width?: number;
      leading?: number;
      gap?: number;
    } = {},
  ) => {
    const size = options.size ?? 9.5;
    const font = options.font ?? regular;
    const color = options.color ?? ink;
    const x = 48 + (options.indent ?? 0);
    const width = options.width ?? 516 - (options.indent ?? 0);
    const leading = options.leading ?? size * 1.45;
    const lines = wrapText(value, font, size, width);
    ensure(lines.length * leading + (options.gap ?? 0));
    for (const line of lines) {
      page.drawText(line, { x, y, size, font, color });
      y -= leading;
    }
    y -= options.gap ?? 0;
  };
  const section = (label: string, title: string) => {
    ensure(54);
    y -= 8;
    page.drawText(label.toUpperCase().split("").join(" "), {
      x: 48,
      y,
      size: 6.5,
      font: bold,
      color: blue,
    });
    y -= 22;
    text(title, { size: 16, font: serifBold, gap: 7 });
    page.drawLine({
      start: { x: 48, y },
      end: { x: 564, y },
      thickness: 0.65,
      color: rule,
    });
    y -= 15;
  };
  const recordRow = (primary: string, secondary: string, right = "") => {
    const primaryLines = wrapText(primary, bold, 8.6, 350);
    const secondaryLines = wrapText(secondary, regular, 7.5, 350);
    const height = Math.max(
      38,
      primaryLines.length * 11 + secondaryLines.length * 9 + 12,
    );
    ensure(height);
    const top = y;
    for (const line of primaryLines) {
      page.drawText(line, { x: 58, y, size: 8.6, font: bold, color: ink });
      y -= 11;
    }
    for (const line of secondaryLines) {
      page.drawText(line, { x: 58, y, size: 7.5, font: regular, color: muted });
      y -= 9;
    }
    if (right)
      page.drawText(right, {
        x: 554 - bold.widthOfTextAtSize(right, 8.4),
        y: top,
        size: 8.4,
        font: bold,
        color: blue,
      });
    y = top - height;
    page.drawLine({
      start: { x: 48, y: y + 5 },
      end: { x: 564, y: y + 5 },
      thickness: 0.4,
      color: rule,
    });
  };

  addPage();
  text(TITLES[type], { size: 27, font: serifBold, color: navy, leading: 31 });
  text("OFFICIAL PRIVATE INSTITUTIONAL RECORD", {
    size: 6.6,
    font: bold,
    color: gold,
    gap: 5,
  });
  text(`Issued ${issuedAt.toLocaleString()}  |  Document ID ${documentId}`, {
    size: 7.2,
    color: muted,
    gap: 12,
  });
  page.drawRectangle({
    x: 48,
    y: y - 55,
    width: 516,
    height: 58,
    color: rgb(0.93, 0.94, 0.92),
    borderWidth: 0.6,
    borderColor: rule,
  });
  page.drawText(record.name, {
    x: 62,
    y: y - 19,
    size: 15,
    font: serifBold,
    color: navy,
  });
  page.drawText(`Student ID: ${record.studentNumber || "PENDING ASSIGNMENT"}`, {
    x: 62,
    y: y - 38,
    size: 7.8,
    font: regular,
    color: muted,
  });
  const campusId = record.academicEmail || "Not issued";
  page.drawText(`Campus ID: ${campusId}`, {
    x: 554 - regular.widthOfTextAtSize(`Campus ID: ${campusId}`, 7.8),
    y: y - 38,
    size: 7.8,
    font: regular,
    color: muted,
  });
  y -= 75;

  if (type === "enrollment-verification") {
    const active = record.courseEnrollments.filter(
      (item) => item.status === "ACTIVE",
    );
    section("Enrollment certification", "Current Enrollment Standing");
    text(
      active.length
        ? `The Office of Admissions and Academic Records certifies that the named student currently maintains active enrollment in ${active.length} institutional course${active.length === 1 ? "" : "s"}.`
        : "The Office of Admissions and Academic Records certifies that no active course enrollment is recorded as of the issue date.",
      { size: 10.2, font: serif, leading: 15, gap: 7 },
    );
    active.forEach((item) =>
      recordRow(
        `${item.course.code}  ${item.course.title}`,
        `Enrollment status: ${item.status}`,
        `${item.course.learningCredits} credits`,
      ),
    );
  } else if (type === "sponsored-learning-statement") {
    section("Sponsored learning", "Account Summary");
    recordRow(
      "Available internal sponsored-learning value",
      "Internal noncash learning-service allocation",
      money(record.grantBalanceCents),
    );
    recordRow(
      "Student responsibility",
      "Payment status: No payment required",
      "$0.00",
    );
    section("Reconciliation", "Recorded Activity");
    record.grantLedger.forEach((item) =>
      recordRow(
        item.description,
        `${new Date(item.createdAt).toLocaleDateString()}  |  ${item.type.replaceAll("_", " ")}`,
        `${item.amountCents >= 0 ? "+" : ""}${money(item.amountCents)}`,
      ),
    );
  } else if (type === "program-audit") {
    const enrollment = record.programEnrollments[0];
    section("Degree audit services", "Active Academic Pathway");
    if (!enrollment)
      text("No active academic program enrollment is currently recorded.", {
        size: 10,
      });
    else {
      recordRow(
        `${enrollment.program.code}  ${enrollment.program.title}`,
        `Pathway level: ${enrollment.program.level}  |  Enrollment status: ${enrollment.status}`,
        `${enrollment.creditsEarned} / ${enrollment.program.creditsRequired} credits`,
      );
    }
    section("Applied learning", "Completed Coursework and Credentials");
    record.courseEnrollments
      .filter((item) => item.status === "COMPLETED")
      .forEach((item) =>
        recordRow(
          `${item.course.code}  ${item.course.title}`,
          "Completed institutional coursework",
          `${item.course.learningCredits} credits`,
        ),
      );
    record.certificates.forEach((item) =>
      recordRow(
        `${item.credentialCode}  ${item.title}`,
        `Issued ${new Date(item.issuedAt).toLocaleDateString()}`,
        `${item.learningCredits} credits`,
      ),
    );
  } else {
    section("Academic history", "Institutional Course Record");
    record.courseEnrollments.forEach((item) =>
      recordRow(
        `${item.course.code}  ${item.course.title}`,
        `Status: ${item.status}  |  Recorded progress: ${item.progress}%`,
        `${item.course.learningCredits} credits`,
      ),
    );
    section("Completion record", "Institutional Credentials");
    if (!record.certificates.length)
      text("No institutional credentials have been issued at this time.", {
        size: 9.5,
      });
    record.certificates.forEach((item) =>
      recordRow(
        `${item.credentialCode}  ${item.title}`,
        `Issued ${new Date(item.issuedAt).toLocaleDateString()}`,
        `${item.learningCredits} credits`,
      ),
    );
  }

  const documentAuthorities: Authority[] =
    type === "enrollment-verification"
      ? [authorities.admissions, authorities.registrar]
      : type === "sponsored-learning-statement"
        ? [authorities.sponsored, authorities.registrar]
        : [authorities.registrar, authorities.dean];
  ensure(155);
  section("Institutional authority", "Digitally Issued and Certified");
  const signatureY = y - 24;
  documentAuthorities.forEach((authority, index) => {
    const x = 48 + index * 258;
    const signedName = authority.name.replace(/^(Dr\.|Dean)\s+/i, "");
    const signatureSize = 24;
    page.drawText(signedName, {
      x,
      y: signatureY + 13,
      size: signatureSize,
      font: signatureFont,
      color: rgb(0.035, 0.22, 0.34),
      rotate: degrees(index === 0 ? -1.2 : 0.8),
    });
    const flourishStart = Math.min(155, signatureFont.widthOfTextAtSize(signedName, signatureSize) + 8);
    page.drawLine({
      start: { x: x + Math.max(20, flourishStart - 35), y: signatureY + 15 },
      end: { x: x + Math.min(195, flourishStart + 38), y: signatureY + 19 },
      thickness: 0.75,
      color: rgb(0.035, 0.22, 0.34),
      opacity: 0.9,
    });
    page.drawLine({
      start: { x, y: signatureY + 12 },
      end: { x: x + 210, y: signatureY + 12 },
      thickness: 0.7,
      color: ink,
    });
    page.drawText(authority.name, {
      x,
      y: signatureY,
      size: 7.8,
      font: bold,
      color: ink,
    });
    page.drawText(authority.title, {
      x,
      y: signatureY - 11,
      size: 7.2,
      font: regular,
      color: muted,
    });
    const signatureDigest = createHash("sha256")
      .update(`${documentId}:${authority.name}:${authority.title}`)
      .digest("hex")
      .toUpperCase()
      .slice(0, 12);
    page.drawText(`AUTHORIZED ELECTRONIC SIGNATURE  ${signatureDigest}`, {
      x,
      y: signatureY - 22,
      size: 5.5,
      font: bold,
      color: gold,
    });
  });
  y = signatureY - 82;

  ensure(type === "sponsored-learning-statement" ? 100 : 82);
  section("Required notice", "Institutional Status and Record Control");
  text(
    "Enscript University is an independent, non-accredited online learning institution. This private institutional record is not an accredited transcript, degree, professional license, or guarantee of transfer, employer acceptance, or third-party recognition.",
    { size: 7.4, color: muted, leading: 10.5, gap: 5 },
  );
  if (type === "sponsored-learning-statement")
    text(
      "All dollar figures are internal noncash service-value statistics. They are not tuition, financial aid, cash, a loan, stored value, or student debt. Student responsibility remains $0.00.",
      { size: 7.4, color: muted, leading: 10.5, gap: 5 },
    );
  text(
    "This digitally generated record may be retained by the named student. Unauthorized alteration, fraudulent reproduction, or misuse of the institutional identity or electronic authority marks is prohibited. Verify using the document ID and verification code shown on this record.",
    { size: 7.4, color: muted, leading: 10.5 },
  );

  pages.forEach((currentPage, index) => {
    currentPage.drawRectangle({
      x: 0,
      y: 0,
      width: 612,
      height: 74,
      color: navy,
    });
    currentPage.drawText(`DOCUMENT ID  ${documentId}`, {
      x: 48,
      y: 45,
      size: 6.2,
      font: bold,
      color: rgb(0.75, 0.84, 0.87),
    });
    currentPage.drawText(`VERIFICATION  ${verificationCode}`, {
      x: 48,
      y: 31,
      size: 6.2,
      font: bold,
      color: gold,
    });
    const pageLabel = `PAGE ${index + 1} OF ${pages.length}`;
    currentPage.drawText(pageLabel, {
      x: 564 - bold.widthOfTextAtSize(pageLabel, 6.2),
      y: 45,
      size: 6.2,
      font: bold,
      color: rgb(0.75, 0.84, 0.87),
    });
    currentPage.drawText(
      "PRIVATE INSTITUTIONAL RECORD - ALTERATION INVALIDATES THIS DOCUMENT",
      {
        x: 48,
        y: 16,
        size: 5.7,
        font: regular,
        color: rgb(0.62, 0.7, 0.73),
      },
    );
    currentPage.drawText(DOCUMENT_RENDERER_VERSION.toUpperCase(), {
      x:
        564 -
        regular.widthOfTextAtSize(
          DOCUMENT_RENDERER_VERSION.toUpperCase(),
          5.2,
        ),
      y: 16,
      size: 5.2,
      font: regular,
      color: rgb(0.62, 0.7, 0.73),
    });
  });

  const bytes = await pdf.save();
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "STUDENT_DOCUMENT_DOWNLOADED",
      entity: "StudentDocument",
      entityId: documentId,
      detail: {
        type,
        documentId,
        verificationCode,
        rendererVersion: DOCUMENT_RENDERER_VERSION,
        authorities: documentAuthorities,
      },
    },
  });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="enscript-${type}-${record.studentNumber || "student"}.pdf"`,
      "cache-control": "private, no-store",
      "x-document-id": documentId,
      "x-document-renderer-version": DOCUMENT_RENDERER_VERSION,
    },
  });
}
