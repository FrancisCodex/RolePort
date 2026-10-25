import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdfSafe } from "@/components/cv/cv-pdf";
import { paragraphsOf, type LetterContent } from "@/lib/letter/types";

/*
 * The cover letter as a PDF: a plain business letter in the same type as the CV, so the two
 * look like a set. Rendered in the browser (lib/letter/pdf.tsx) in both editions.
 */

const styles = StyleSheet.create({
  page: { paddingVertical: 56, paddingHorizontal: 64, fontFamily: "Helvetica", fontSize: 11, lineHeight: 1.45, color: "#111" },
  name: { fontFamily: "Helvetica-Bold", fontSize: 16, lineHeight: 1.2 },
  contact: { fontSize: 9.5, marginTop: 3, color: "#333" },
  date: { marginTop: 24 },
  recipient: { marginTop: 14 },
  greeting: { marginTop: 18 },
  paragraph: { marginTop: 10 },
  closing: { marginTop: 18 },
  signature: { marginTop: 4 },
});

export function LetterDocument({ letter }: { letter: LetterContent }) {
  const s = pdfSafe;
  const contact = [letter.contact.email, letter.contact.phone, letter.contact.location].filter(Boolean);
  return (
    <Document title={s(`${letter.name} - Cover letter`)} author={s(letter.name)} creator="HireMe" producer="HireMe">
      <Page size={letter.pageSize} style={styles.page}>
        <Text style={styles.name}>{s(letter.name)}</Text>
        {contact.length > 0 && <Text style={styles.contact}>{s(contact.join("  |  "))}</Text>}
        {letter.date ? <Text style={styles.date}>{s(letter.date)}</Text> : null}
        {letter.recipient ? (
          <View style={styles.recipient}>
            {letter.recipient
              .split("\n")
              .filter((l) => l.trim())
              .map((l, i) => (
                <Text key={i}>{s(l.trim())}</Text>
              ))}
          </View>
        ) : null}
        {letter.greeting ? <Text style={styles.greeting}>{s(letter.greeting)}</Text> : null}
        {paragraphsOf(letter.body).map((p, i) => (
          <Text key={i} style={styles.paragraph}>
            {s(p)}
          </Text>
        ))}
        <View style={styles.closing} wrap={false}>
          {letter.closing ? <Text>{s(letter.closing)}</Text> : null}
          <Text style={styles.signature}>{s(letter.name)}</Text>
        </View>
      </Page>
    </Document>
  );
}
