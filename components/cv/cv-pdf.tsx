import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { cvDates, type CvContent } from "@/lib/cv/types";

/*
 * The CV as a PDF, laid out for applicant tracking systems: one column, real text in reading
 * order, standard section names, a built-in font, no tables, icons, images or text boxes.
 * Rendered in the browser (lib/cv/pdf.ts), so it works the same in both editions.
 */

// ATS parsers read a hyphenated word as two words: never split words across lines.
Font.registerHyphenationCallback((word) => [word]);

/**
 * Helvetica is a built-in PDF font limited to Western European characters (WinAnsi). Swap the
 * few common outsiders for close equivalents and drop the rest, so nothing prints as garbage.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/₱/g, "PHP ")
    .replace(/[‐-‒]/g, "-")
    .replace(/[   ]/g, " ")
    .normalize("NFC")
    .replace(/[^ -~¡-ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ\n]/g, (ch) => ch.normalize("NFKD").replace(/[^ -~]/g, ""));
}

const styles = StyleSheet.create({
  page: { paddingVertical: 40, paddingHorizontal: 46, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.35, color: "#111" },
  name: { fontFamily: "Helvetica-Bold", fontSize: 18, lineHeight: 1.2 },
  headline: { fontSize: 11, marginTop: 2, color: "#333" },
  contact: { fontSize: 9, marginTop: 4, color: "#333" },
  section: { marginTop: 12 },
  heading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    borderBottomWidth: 0.75,
    borderBottomColor: "#999",
    paddingBottom: 2,
    marginBottom: 5,
  },
  role: { marginBottom: 7 },
  roleLine: { flexDirection: "row", justifyContent: "space-between" },
  roleTitle: { fontFamily: "Helvetica-Bold", flexShrink: 1, paddingRight: 8 },
  dates: { color: "#333", flexShrink: 0 },
  company: { color: "#333" },
  bullet: { flexDirection: "row", marginTop: 1.5 },
  dot: { width: 10 },
  bulletText: { flex: 1 },
});


export function CvDocument({ cv }: { cv: CvContent }) {
  const s = pdfSafe;
  const contact = [cv.contact.email, cv.contact.phone, cv.contact.location, ...cv.contact.links].filter(Boolean);
  return (
    <Document title={s(`${cv.name} - CV`)} author={s(cv.name)} subject={s(cv.headline)} creator="RolePort" producer="RolePort">
      <Page size={cv.pageSize} style={styles.page}>
        <Text style={styles.name}>{s(cv.name)}</Text>
        {cv.headline ? <Text style={styles.headline}>{s(cv.headline)}</Text> : null}
        {contact.length > 0 && <Text style={styles.contact}>{s(contact.join("  |  "))}</Text>}

        {cv.summary ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Summary</Text>
            <Text>{s(cv.summary)}</Text>
          </View>
        ) : null}

        {cv.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Skills</Text>
            <Text>{s(cv.skills.join(", "))}</Text>
          </View>
        )}

        {cv.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Experience</Text>
            {cv.experience.map((e, i) => (
              <View key={i} style={styles.role} wrap={e.bullets.length > 4}>
                <View style={styles.roleLine}>
                  <Text style={styles.roleTitle}>{s(e.role)}</Text>
                  <Text style={styles.dates}>{s(cvDates(e.start, e.end))}</Text>
                </View>
                <Text style={styles.company}>{s([e.company, e.location].filter(Boolean).join(", "))}</Text>
                {e.bullets.map((b, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.bulletText}>{s(b)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {cv.education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Education</Text>
            {cv.education.map((e, i) => (
              <View key={i} style={{ marginBottom: 4 }} wrap={false}>
                <View style={styles.roleLine}>
                  <Text style={styles.roleTitle}>{s([e.degree, e.field].filter(Boolean).join(", "))}</Text>
                  {e.year ? <Text style={styles.dates}>{s(e.year)}</Text> : null}
                </View>
                <Text style={styles.company}>{s(e.school)}</Text>
              </View>
            ))}
          </View>
        )}

        {cv.sections.map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.heading}>{s(section.title)}</Text>
            {section.items.map((item, j) => (
              <View key={j} style={styles.role} wrap={item.details.length > 4}>
                <View style={styles.roleLine}>
                  <Text style={styles.roleTitle}>{s(item.title)}</Text>
                  {item.date ? <Text style={styles.dates}>{s(item.date)}</Text> : null}
                </View>
                {item.subtitle || item.link ? <Text style={styles.company}>{s([item.subtitle, item.link].filter(Boolean).join(", "))}</Text> : null}
                {item.details.map((d, k) => (
                  <View key={k} style={styles.bullet}>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.bulletText}>{s(d)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}

        {cv.languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Languages</Text>
            <Text>{s(cv.languages.join(", "))}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
