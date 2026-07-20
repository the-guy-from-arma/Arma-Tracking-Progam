import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getUTCDay();
  const distance = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - distance);
  date.setUTCHours(12, 0, 0, 0);
  return date;
}

function editionNumber(value: Date) {
  const first = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const elapsedDays = Math.floor((value.getTime() - first.getTime()) / 86_400_000);
  return `${value.getUTCFullYear()}.${String(Math.ceil((elapsedDays + first.getUTCDay() + 1) / 7)).padStart(2, "0")}`;
}

function cleanExcerpt(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]+\]\([^\)]+\)/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 760);
}

function deskFor(title: string, academy?: string) {
  const value = `${title} ${academy || ""}`.toLowerCase();
  if (value.includes("script") || value.includes("code")) return "Enforce Script Desk";
  if (value.includes("terrain") || value.includes("world")) return "World Building Desk";
  if (value.includes("replication") || value.includes("network")) return "Multiplayer Systems Desk";
  if (value.includes("animation") || value.includes("character")) return "Animation & Character Desk";
  if (value.includes("vehicle") || value.includes("weapon")) return "Simulation Systems Desk";
  if (value.includes("interface") || value.includes("ui")) return "Interface Desk";
  return "Workbench Desk";
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const sources = await db.curriculumSource.findMany({
    where: {
      disabledAt: null,
      lastSuccessAt: { not: null },
    },
    orderBy: [{ lastSuccessAt: "desc" }, { updatedAt: "desc" }],
    take: 12,
    include: {
      mappings: {
        take: 3,
        include: {
          course: {
            select: { id: true, code: true, title: true, academy: true, status: true, catalogVisible: true },
          },
        },
      },
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
        include: { media: { orderBy: { displayOrder: "asc" }, take: 1 } },
      },
    },
  });

  const week = startOfWeek(new Date());
  const articles = sources
    .map((source, index) => {
      const snapshot = source.snapshots[0];
      const relatedCourses = source.mappings
        .map((mapping) => mapping.course)
        .filter((course) => course.status === "PUBLISHED" && course.catalogVisible)
        .slice(0, 3);
      const academy = relatedCourses[0]?.academy;
      const summary = cleanExcerpt(source.lastGoodExcerpt || source.sourceExcerpt || "");
      if (!summary) return null;
      return {
        id: source.id,
        position: index + 1,
        desk: deskFor(source.wikiTitle, academy),
        headline: source.wikiTitle.replace(/^Arma Reforger:\s*/i, ""),
        summary,
        sourceTitle: source.wikiTitle,
        sourceUrl: source.url,
        revisionId: snapshot?.revisionId || source.lastGoodRevisionId || source.revisionId,
        sourceUpdatedAt: snapshot?.revisionTimestamp || source.revisionTimestamp || source.lastSuccessAt,
        image: snapshot?.media[0]
          ? {
              url: snapshot.media[0].url,
              altText: snapshot.media[0].altText,
              caption: snapshot.media[0].caption,
              width: snapshot.media[0].width,
              height: snapshot.media[0].height,
              filePageUrl: snapshot.media[0].filePageUrl,
            }
          : null,
        relatedCourses,
      };
    })
    .filter((article): article is NonNullable<typeof article> => Boolean(article));

  const desks = [...new Set(articles.map((article) => article.desk))];
  return NextResponse.json({
    publication: "Enscript Development Weekly",
    edition: editionNumber(week),
    publishedAt: week.toISOString(),
    headline: articles[0]?.headline || "This week in Enfusion development",
    deck: articles.length
      ? "A weekly field report on Enfusion Workbench, Arma Reforger development, and the source material shaping current Enscript University instruction."
      : "The Academic Editorial Office is preparing the next source-verified development edition.",
    sourceCount: articles.length,
    desks,
    articles,
    attribution: "Technical reporting is summarized from approved Bohemia Interactive Community Wiki sources. Enscript University is independent and is not affiliated with or endorsed by Bohemia Interactive.",
  });
}
