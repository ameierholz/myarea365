import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Privacy");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function DatenschutzPage() {
  const t = await getTranslations("Privacy");

  const richTags = {
    b: (chunks: React.ReactNode) => <b className="text-text">{chunks}</b>,
    strong: (chunks: React.ReactNode) => <b className="text-text">{chunks}</b>,
    i: (chunks: React.ReactNode) => <i>{chunks}</i>,
    code: (chunks: React.ReactNode) => <code>{chunks}</code>,
    impressumLink: (chunks: React.ReactNode) => (
      <Link href="/impressum" className="text-primary hover:underline">{chunks}</Link>
    ),
    datenschutzLink: (chunks: React.ReactNode) => (
      <Link href="/datenschutz" className="text-primary hover:underline">{chunks}</Link>
    ),
    supportMail: (chunks: React.ReactNode) => (
      <a href="mailto:support@myarea365.de" className="text-primary hover:underline">{chunks}</a>
    ),
    googlePolicies: (chunks: React.ReactNode) => (
      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{chunks}</a>
    ),
    googleAdsSettings: (chunks: React.ReactNode) => (
      <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{chunks}</a>
    ),
    icoLink: (chunks: React.ReactNode) => (
      <a href="https://ico.org.uk/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{chunks}</a>
    ),
    edoebLink: (chunks: React.ReactNode) => (
      <a href="https://www.edoeb.admin.ch/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{chunks}</a>
    ),
    anpdLink: (chunks: React.ReactNode) => (
      <a href="https://www.gov.br/anpd/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{chunks}</a>
    ),
    privCanada: (chunks: React.ReactNode) => (
      <a href="https://www.priv.gc.ca/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{chunks}</a>
    ),
    oaicLink: (chunks: React.ReactNode) => (
      <a href="https://www.oaic.gov.au/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{chunks}</a>
    ),
    berlinDpa: (chunks: React.ReactNode) => (
      <a href="https://www.datenschutz-berlin.de/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{chunks}</a>
    ),
    odrLink: (chunks: React.ReactNode) => (
      <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{chunks}</a>
    ),
  };

  // Helper: read array from messages
  const arr = (key: string): string[] => (t.raw(key) as string[]) ?? [];

  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-primary hover:underline">{t("back")}</Link>
      <h1 className="text-3xl font-bold mt-6 mb-2">{t("title")}</h1>
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
          <p>{t("s1.p1")}</p>
          <p className="mt-2">
            Andre Meierholz<br />
            Kolonnenstr. 8<br />
            10827 Berlin<br />
            {t("s1.country")}<br />
            {t("s1.emailLabel")}{" "}
            <a href="mailto:support@myarea365.de" className="text-primary hover:underline">
              support@myarea365.de
            </a>
          </p>
          <p className="text-xs mt-2 italic">{t.rich("s1.imprintNote", richTags)}</p>
        </Section>

        <Section num="2" title={t("s2.title")}>
          <p>{t.rich("s2.body", richTags)}</p>
        </Section>

        <Section num="3" title={t("s3.title")}>
          <p>{t("s3.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>{t.rich("s3.li1", richTags)}</li>
            <li>{t.rich("s3.li2", richTags)}</li>
            <li>{t.rich("s3.li3", richTags)}</li>
            <li>{t.rich("s3.li4", richTags)}</li>
            <li>{t.rich("s3.li5", richTags)}</li>
            <li>{t.rich("s3.li6", richTags)}</li>
          </ul>
        </Section>

        <Section num="4" title={t("s4.title")}>
          <p className="mb-4">{t("s4.intro")}</p>

          <SubSection title={t("s4.s1.title")}>
            <DataList items={arr("s4.s1.items")} />
            <p className="text-xs mt-2">{t("s4.s1.basis")}</p>
          </SubSection>

          <SubSection title={t("s4.s2.title")}>
            <DataList items={arr("s4.s2.items")} />
            <p className="text-xs mt-2">{t("s4.s2.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s3.title")}>
            <DataList items={arr("s4.s3.items")} />
            <p className="text-xs mt-2">{t("s4.s3.basis")}</p>
          </SubSection>

          <SubSection title={t("s4.s4.title")}>
            <DataList items={arr("s4.s4.items")} />
            <p className="text-xs mt-2">{t("s4.s4.basis")}</p>
          </SubSection>

          <SubSection title={t("s4.s5.title")}>
            <DataList items={arr("s4.s5.items")} />
            <p className="text-xs mt-2">{t("s4.s5.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s6.title")}>
            <DataList items={arr("s4.s6.items")} />
            <p className="text-xs mt-2">{t("s4.s6.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s7.title")}>
            <DataList items={arr("s4.s7.items")} />
            <p className="text-xs mt-2">{t("s4.s7.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s8.title")}>
            <DataList items={arr("s4.s8.items")} />
            <p className="text-xs mt-2">{t("s4.s8.basis")}</p>
          </SubSection>

          <SubSection title={t("s4.s9.title")}>
            <DataList items={arr("s4.s9.items")} />
            <p className="text-xs mt-2">{t("s4.s9.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s10.title")}>
            <DataList items={arr("s4.s10.items")} />
            <p className="text-xs mt-2">{t("s4.s10.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s11.title")}>
            <DataList items={arr("s4.s11.items")} />
            <p className="text-xs mt-2">{t("s4.s11.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s12.title")}>
            <p className="text-xs">{t.rich("s4.s12.body", richTags)}</p>
          </SubSection>

          <SubSection title={t("s4.s13.title")}>
            <DataList items={arr("s4.s13.items")} />
            <p className="text-xs mt-2">{t("s4.s13.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s14.title")}>
            <DataList items={arr("s4.s14.items")} />
            <p className="text-xs mt-2">{t("s4.s14.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s15.title")}>
            <DataList items={arr("s4.s15.items")} />
            <p className="text-xs mt-2">{t("s4.s15.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s16.title")}>
            <DataList items={arr("s4.s16.items")} />
            <p className="text-xs mt-2">{t("s4.s16.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s17.title")}>
            <DataList items={arr("s4.s17.items")} />
            <p className="text-xs mt-2">{t.rich("s4.s17.note", richTags)}</p>
          </SubSection>

          <SubSection title={t("s4.s18.title")}>
            <p className="text-sm">{t("s4.s18.body")}</p>
            <p className="text-xs mt-2">{t("s4.s18.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s19.title")}>
            <p className="text-sm">{t.rich("s4.s19.body", richTags)}</p>
          </SubSection>

          <SubSection title={t("s4.s20.title")}>
            <DataList items={arr("s4.s20.items")} />
            <p className="text-xs mt-2">{t("s4.s20.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s21.title")}>
            <DataList items={arr("s4.s21.items")} />
            <p className="text-xs mt-2">{t("s4.s21.note")}</p>
          </SubSection>

          <SubSection title={t("s4.s22.title")}>
            <p className="text-sm">{t.rich("s4.s22.p1", richTags)}</p>
            <p className="text-sm mt-2">{t.rich("s4.s22.p2", richTags)}</p>
            <p className="text-sm mt-2">{t.rich("s4.s22.p3", richTags)}</p>
            <p className="text-xs mt-2">{t("s4.s22.basis")}</p>
          </SubSection>

          <SubSection title={t("s4.s23.title")}>
            <DataList items={arr("s4.s23.items")} />
          </SubSection>
        </Section>

        <Section num="5" title={t("s5.title")}>
          <p>{t.rich("s5.p1", richTags)}</p>
          <p className="mt-2 text-sm">{t.rich("s5.p2", richTags)}</p>
        </Section>

        <Section num="6" title={t("s6.title")}>
          <p>{t("s6.intro")}</p>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text">
                  <th className="text-left py-2 pr-2 font-bold">{t("s6.colService")}</th>
                  <th className="text-left py-2 pr-2 font-bold">{t("s6.colPurpose")}</th>
                  <th className="text-left py-2 font-bold">{t("s6.colLocation")}</th>
                </tr>
              </thead>
              <tbody>
                {(t.raw("s6.rows") as Array<{ d: string; z: string; l: string }>).map((row, i) => (
                  <Row key={i} d={row.d} z={row.z} l={row.l} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs italic mt-2">{t("s6.footnote")}</p>
        </Section>

        <Section num="7" title={t("s7.title")}>
          <p>{t("s7.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s7.items").map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          <p className="text-xs mt-2 italic">{t("s7.footnote")}</p>
        </Section>

        <Section num="8" title={t("s8.title")}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse mt-2">
              <thead>
                <tr className="border-b border-border text-text">
                  <th className="text-left py-2 pr-2 font-bold">{t("s8.colCategory")}</th>
                  <th className="text-left py-2 font-bold">{t("s8.colDuration")}</th>
                </tr>
              </thead>
              <tbody>
                {(t.raw("s8.rows") as Array<{ d: string; l: string }>).map((row, i) => (
                  <Row key={i} d={row.d} z="" l={row.l} />
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section num="9" title={t("s9.title")}>
          <p>{t("s9.intro")}</p>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text">
                  <th className="text-left py-2 pr-2 font-bold">{t("s9.colName")}</th>
                  <th className="text-left py-2 pr-2 font-bold">{t("s9.colPurpose")}</th>
                  <th className="text-left py-2 font-bold">{t("s9.colDuration")}</th>
                </tr>
              </thead>
              <tbody>
                {(t.raw("s9.rows") as Array<{ d: string; z: string; l: string }>).map((row, i) => (
                  <Row key={i} d={row.d} z={row.z} l={row.l} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm">{t.rich("s9.note", richTags)}</p>
        </Section>

        <Section num="10" title={t("s10.title")}>
          <p>{t("s10.body")}</p>
        </Section>

        <Section num="11" title={t("s11.title")}>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {arr("s11.items").map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </Section>

        <Section num="12" title={t("s12.title")}>
          <SubSection title={t("s12.s1.title")}>
            <p className="text-sm">{t.rich("s12.s1.body", richTags)}</p>
          </SubSection>

          <SubSection title={t("s12.s2.title")}>
            <p className="text-sm">{t.rich("s12.s2.body", richTags)}</p>
          </SubSection>

          <SubSection title={t("s12.s3.title")}>
            <p className="text-sm">{t("s12.s3.intro")}</p>
            <ul className="list-disc list-inside space-y-1 text-sm mt-2">
              {arr("s12.s3.rights").map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: it }} />)}
            </ul>
            <p className="text-sm mt-3">{t.rich("s12.s3.note", richTags)}</p>
          </SubSection>

          <SubSection title={t("s12.s4.title")}>
            <p className="text-sm">{t.rich("s12.s4.body", richTags)}</p>
          </SubSection>

          <SubSection title={t("s12.s5.title")}>
            <p className="text-sm">{t.rich("s12.s5.body", richTags)}</p>
          </SubSection>
        </Section>

        <Section num="13" title={t("s13.title")}>
          <p>{t("s13.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s13.items").map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </Section>

        <Section num="14" title={t("s14.title")}>
          <p>{t("s14.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s14.rights").map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: it }} />)}
            <li>{t.rich("s14.complaint", richTags)}</li>
          </ul>
          <p className="mt-3 text-sm">{t.rich("s14.note", richTags)}</p>
        </Section>

        <Section num="15" title={t("s15.title")}>
          <p>{t("s15.p1")}</p>
          <p className="text-sm mt-2">{t("s15.p2")}</p>
        </Section>

        <Section num="16" title={t("s16.title")}>
          <p>{t.rich("s16.intro", richTags)}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s16.items").map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: it }} />)}
          </ul>
          <p className="text-sm mt-2">{t("s16.note")}</p>
        </Section>

        <Section num="17" title={t("s17.title")}>
          <p>{t("s17.p1")}</p>
          <p className="text-sm mt-2">{t("s17.p2")}</p>
        </Section>

        <Section num="18" title={t("s18.title")}>
          <p>{t("s18.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s18.items").map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          <p className="text-sm mt-2">{t.rich("s18.note", richTags)}</p>
        </Section>

        <Section num="19" title={t("s19.title")}>
          <p>{t("s19.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s19.items").map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          <p className="text-sm mt-2">{t("s19.note")}</p>
        </Section>

        <Section num="20" title={t("s20.title")}>
          <p>{t("s20.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s20.items").map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          <p className="text-sm mt-2">{t("s20.note")}</p>
        </Section>

        <Section num="21" title={t("s21.title")}>
          <p>{t("s21.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            {arr("s21.items").map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          <p className="text-sm mt-2">{t("s21.note")}</p>
        </Section>

        <Section num="22" title={t("s22.title")}>
          <p>{t("s22.p1")}</p>
          <p className="text-sm mt-2">{t("s22.p2")}</p>
        </Section>

        <Section num="23" title={t("s23.title")}>
          <p>{t("s23.body")}</p>
        </Section>

        <Section num="24" title={t("s24.title")}>
          <p>{t("s24.intro")}</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>{t.rich("s24.li1", richTags)}</li>
            <li>{t("s24.li2")}</li>
            <li>{t.rich("s24.li3", richTags)}</li>
            <li>{t("s24.li4")}</li>
          </ul>
          <p className="text-sm mt-2">{t("s24.note")}</p>
        </Section>

        <Section num="25" title={t("s25.title")}>
          <p>{t.rich("s25.body", richTags)}</p>
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
      <h2 className="text-lg font-bold text-text mb-2">{num}. {title}</h2>
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

function DataList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-0.5 text-sm">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

function Row({ d, z, l }: { d: string; z: string; l: string }) {
  return (
    <tr className="border-b border-border/40">
      <td className="py-2 pr-2 text-text font-bold">{d}</td>
      {z && <td className="py-2 pr-2">{z}</td>}
      <td className="py-2" dangerouslySetInnerHTML={{ __html: l }} />
    </tr>
  );
}
