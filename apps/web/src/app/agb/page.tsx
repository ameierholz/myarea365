import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Terms");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AgbPage() {
  const t = await getTranslations("Terms");

  const richTags = {
    b: (chunks: React.ReactNode) => <b className="text-text">{chunks}</b>,
    strong: (chunks: React.ReactNode) => <b className="text-text">{chunks}</b>,
    i: (chunks: React.ReactNode) => <i>{chunks}</i>,
    impressumLink: (chunks: React.ReactNode) => (
      <Link href="/impressum" className="text-primary hover:underline">{chunks}</Link>
    ),
    datenschutzLink: (chunks: React.ReactNode) => (
      <Link href="/datenschutz" className="text-primary hover:underline">{chunks}</Link>
    ),
    supportMail: (chunks: React.ReactNode) => (
      <a href="mailto:support@myarea365.de" className="text-primary hover:underline">{chunks}</a>
    ),
    odrLink: (chunks: React.ReactNode) => (
      <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{chunks}</a>
    ),
  };

  const arr = (key: string): string[] => (t.raw(key) as string[]) ?? [];

  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-primary hover:underline">{t("back")}</Link>
      <h1 className="text-3xl font-bold mt-6 mb-2">{t("title")}</h1>
      <p className="text-sm text-text-muted mb-1">{t("subtitle")}</p>
      <p className="text-xs text-text-muted mb-8">
        {t("lastUpdated", {
          date: new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }),
        })}
      </p>

      <div className="space-y-8 text-text-muted leading-relaxed">

        <section>
          <p className="text-sm">{t.rich("intro", richTags)}</p>
        </section>

        <Section num="1" title={t("s1.title")}>
          <p>{t.rich("s1.body", richTags)}</p>
        </Section>

        <Section num="2" title={t("s2.title")}>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {arr("s2.items").map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: it }} />)}
          </ul>
        </Section>

        <Section num="3" title={t("s3.title")}>
          <p>{t("s3.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s3.items").map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          <p className="text-sm mt-2">{t("s3.note")}</p>
        </Section>

        <Section num="4" title={t("s4.title")}>
          <p className="text-sm">{t("s4.p1")}</p>
          <p className="text-sm mt-2">{t.rich("s4.p2", richTags)}</p>
          <p className="text-sm mt-2">{t("s4.p3")}</p>
        </Section>

        <Section num="5" title={t("s5.title")}>
          <p className="text-sm">{t.rich("s5.p1", richTags)}</p>
          <p className="text-sm mt-2">{t("s5.p2")}</p>
        </Section>

        <Section num="6" title={t("s6.title")}>
          <p className="text-sm">{t("s6.body")}</p>
        </Section>

        <Section num="7" title={t("s7.title")}>
          <SubSection title={t("s7.s1.title")}>
            <p className="text-sm">{t.rich("s7.s1.body", richTags)}</p>
          </SubSection>
          <SubSection title={t("s7.s2.title")}>
            <p className="text-sm">{t.rich("s7.s2.intro", richTags)}</p>
            <ul className="list-disc list-inside space-y-1 text-sm mt-2">
              {arr("s7.s2.items").map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: it }} />)}
            </ul>
            <p className="text-sm mt-2">{t.rich("s7.s2.note", richTags)}</p>
          </SubSection>
          <SubSection title={t("s7.s3.title")}>
            <p className="text-sm">{t.rich("s7.s3.body", richTags)}</p>
          </SubSection>
          <SubSection title={t("s7.s4.title")}>
            <p className="text-sm">{t("s7.s4.body")}</p>
          </SubSection>
          <SubSection title={t("s7.s5.title")}>
            <p className="text-sm">{t("s7.s5.body")}</p>
          </SubSection>
          <SubSection title={t("s7.s6.title")}>
            <p className="text-sm">{t.rich("s7.s6.body", richTags)}</p>
          </SubSection>
        </Section>

        <Section num="8" title={t("s8.title")}>
          <p className="text-sm">{t("s8.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s8.items").map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: it }} />)}
          </ul>
          <p className="text-sm mt-2">{t.rich("s8.balance", richTags)}</p>
          <p className="text-sm mt-2">{t.rich("s8.discontinue", richTags)}</p>
        </Section>

        <Section num="9" title={t("s9.title")}>
          <SubSection title={t("s9.s1.title")}>
            <p className="text-sm">{t.rich("s9.s1.p1", richTags)}</p>
            <p className="text-sm mt-2">{t("s9.s1.p2")}</p>
            <p className="text-sm mt-2 pl-4 border-l-2 border-border">
              Andre Meierholz<br />
              {t.rich("s9.s1.address", richTags)}<br />
              {t("s9.s1.emailLabel")}{" "}
              <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>
            </p>
            <p className="text-sm mt-2">{t("s9.s1.p3")}</p>
          </SubSection>

          <SubSection title={t("s9.s2.title")}>
            <p className="text-sm">{t("s9.s2.body")}</p>
          </SubSection>

          <SubSection title={t("s9.s3.title")}>
            <p className="text-sm">{t.rich("s9.s3.intro", richTags)}</p>
            <ul className="list-disc list-inside space-y-1 text-sm mt-2">
              {arr("s9.s3.items").map((it, i) => <li key={i}>{it}</li>)}
            </ul>
            <p className="text-sm mt-2">{t("s9.s3.note")}</p>
          </SubSection>

          <SubSection title={t("s9.s4.title")}>
            <p className="text-sm">{t("s9.s4.intro")}</p>
            <div className="mt-2 p-3 bg-black/20 border border-border rounded text-xs whitespace-pre-line">
              {t("s9.s4.form")}
            </div>
          </SubSection>
        </Section>

        <Section num="10" title={t("s10.title")}>
          <p className="text-sm">{t("s10.p1")}</p>
          <p className="text-sm mt-2">{t("s10.p2")}</p>
        </Section>

        <Section num="11" title={t("s11.title")}>
          <p className="text-sm">{t("s11.body")}</p>
        </Section>

        <Section num="12" title={t("s12.title")}>
          <p className="text-sm">{t("s12.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s12.items").map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          <p className="text-sm mt-2">{t("s12.note")}</p>
          <p className="text-sm mt-2">{t.rich("s12.moderation", richTags)}</p>
          <p className="text-sm mt-2">{t.rich("s12.aiContent", richTags)}</p>
        </Section>

        <Section num="13" title={t("s13.title")}>
          <p className="text-sm">{t("s13.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s13.items").map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          <p className="text-sm mt-3">{t.rich("s13.safety", richTags)}</p>
        </Section>

        <Section num="14" title={t("s14.title")}>
          <p className="text-sm">{t("s14.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s14.items").map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          <p className="text-sm mt-2">{t("s14.note")}</p>
        </Section>

        <Section num="15" title={t("s15.title")}>
          <p className="text-sm">{t("s15.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>{t.rich("s15.li1", richTags)}</li>
            <li>{t.rich("s15.li2", richTags)}</li>
            <li>{t.rich("s15.li3", richTags)}</li>
            <li>{t.rich("s15.li4", richTags)}</li>
            <li>{t.rich("s15.li5", richTags)}</li>
          </ul>
        </Section>

        <Section num="16" title={t("s16.title")}>
          <SubSection title={t("s16.s1.title")}>
            <p className="text-sm">{t("s16.s1.body")}</p>
          </SubSection>
          <SubSection title={t("s16.s2.title")}>
            <p className="text-sm">{t("s16.s2.body")}</p>
          </SubSection>
          <SubSection title={t("s16.s3.title")}>
            <p className="text-sm">{t.rich("s16.s3.p1", richTags)}</p>
            <p className="text-sm mt-2">{t("s16.s3.p2")}</p>
            <p className="text-sm mt-2">{t.rich("s16.s3.p3", richTags)}</p>
          </SubSection>
          <SubSection title={t("s16.s4.title")}>
            <p className="text-sm">{t("s16.s4.body")}</p>
          </SubSection>
          <SubSection title={t("s16.s5.title")}>
            <p className="text-sm">{t("s16.s5.body")}</p>
          </SubSection>
        </Section>

        <Section num="17" title={t("s17.title")}>
          <p className="text-sm">{t.rich("s17.p1", richTags)}</p>
          <p className="text-sm mt-2">{t.rich("s17.p2", richTags)}</p>
          <p className="text-sm mt-2">{t("s17.p3")}</p>
        </Section>

        <Section num="18" title={t("s18.title")}>
          <p className="text-sm">{t.rich("s18.p1", richTags)}</p>
          <p className="text-sm mt-2">{t("s18.p2")}</p>
        </Section>

        <Section num="19" title={t("s19.title")}>
          <p className="text-sm">{t("s19.p1")}</p>
          <p className="text-sm mt-2">{t.rich("s19.p2", richTags)}</p>
          <p className="text-sm mt-2">{t("s19.p3")}</p>
        </Section>

        <Section num="20" title={t("s20.title")}>
          <p className="text-sm">{t("s20.body")}</p>
        </Section>

        <Section num="21" title={t("s21.title")}>
          <SubSection title={t("s21.s1.title")}>
            <p className="text-sm">{t("s21.s1.body")}</p>
          </SubSection>
          <SubSection title={t("s21.s2.title")}>
            <p className="text-sm">{t("s21.s2.body")}</p>
          </SubSection>
          <SubSection title={t("s21.s3.title")}>
            <p className="text-sm">{t("s21.s3.body")}</p>
          </SubSection>
          <SubSection title={t("s21.s4.title")}>
            <p className="text-sm">{t("s21.s4.body")}</p>
          </SubSection>
        </Section>

        <Section num="22" title={t("s22.title")}>
          <p className="text-sm">{t("s22.p1")}</p>
          <p className="text-sm mt-2">{t("s22.p2")}</p>
        </Section>

        <Section num="23" title={t("s23.title")}>
          <p className="text-sm">{t.rich("s23.body", richTags)}</p>
        </Section>

        <Section num="24" title={t("s24.title")}>
          <p className="text-sm">{t("s24.p1")}</p>
          <p className="text-sm mt-2">{t("s24.p2")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s24.items").map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </Section>

        <Section num="25" title={t("s25.title")}>
          <p className="text-sm">{t("s25.body")}</p>
        </Section>

        <Section num="26" title={t("s26.title")}>
          <p className="text-sm">{t("s26.body")}</p>
        </Section>

        <Section num="27" title={t("s27.title")}>
          <p className="text-sm">{t.rich("s27.body", richTags)}</p>
        </Section>

        <Section num="28" title={t("s28.title")}>
          <p className="text-sm">{t.rich("s28.body", richTags)}</p>
        </Section>

        <Section num="29" title={t("s29.title")}>
          <p className="text-sm">{t("s29.p1")}</p>
          <p className="text-sm mt-2">{t("s29.p2")}</p>
        </Section>

        <Section num="30" title={t("s30.title")}>
          <p className="text-sm">{t("s30.body")}</p>
        </Section>

        <Section num="31" title={t("s31.title")}>
          <p className="text-sm">{t("s31.p1")}</p>
          <p className="text-sm mt-2">{t.rich("s31.p2", richTags)}</p>
        </Section>

        <section className="text-xs pt-4 border-t border-border italic">
          {t("footer")}
        </section>
      </div>
    </div>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-text mb-2">§ {num} {title}</h2>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="font-bold text-text text-sm mb-1">{title}</h3>
      {children}
    </div>
  );
}
