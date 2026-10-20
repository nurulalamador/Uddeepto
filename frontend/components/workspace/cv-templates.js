// The CV layouts. They draw a real, text-based A4 PDF with @react-pdf/renderer, so employers can select, search and copy it.
// This file is only loaded by the CV Generator (it is imported on demand because the library is large).
import { Document, Font, Link, Page, Text, View } from "@react-pdf/renderer";
import { dateRange, lines } from "@/lib/cv-data";

// Never break a word in the middle.
Font.registerHyphenationCallback((word) => [word]);

const ink = "#1f2933";
const soft = "#52606d";
const faint = "#9aa5b1";

const has = (value) => Boolean(String(value || "").trim());
const contactOf = (p) => [p.email, p.phone, p.address, p.website].filter(has);
const tint = (hex, amount) => {
  // Mixes a colour with white (amount 0-1 of white) for soft backgrounds.
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
};
const darken = (hex, amount) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c * (1 - amount));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
};
const href = (value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);

/** A description: several lines become bullet points, a single line stays a paragraph. */
function Description({ text, size = 9, color = soft, gap = 2 }) {
  const rows = lines(text);
  if (!rows.length) return null;
  if (rows.length === 1 && !/^\s*[-•*]/.test(text)) return <Text style={{ fontSize: size, color, lineHeight: 1.45, marginTop: 2 }}>{rows[0]}</Text>;
  return (
    <View style={{ marginTop: 2 }}>
      {rows.map((row, index) => (
        <View key={index} style={{ flexDirection: "row", marginBottom: gap }}>
          <Text style={{ width: 9, fontSize: size, color }}>•</Text>
          <Text style={{ flex: 1, fontSize: size, color, lineHeight: 1.4 }}>{row}</Text>
        </View>
      ))}
    </View>
  );
}

function ProjectLink({ value, size = 8.5, color }) {
  if (!has(value)) return null;
  return (
    <Link src={href(value)} style={{ fontSize: size, color, textDecoration: "none" }}>
      {value}
    </Link>
  );
}

function Shell({ data, children, size = "A4", page }) {
  return (
    <Document title={`${data.personal.name || "CV"} - CV`} author={data.personal.name || undefined} creator="Uddeepto CV Generator" producer="Uddeepto">
      <Page size={size} style={{ fontFamily: "Helvetica", color: ink, ...page }}>
        {children}
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ Classic */
function Classic({ data }) {
  const { personal: p, accent } = data;
  const serif = "Times-Roman";
  const bold = "Times-Bold";
  const Heading = ({ children }) => (
    <View style={{ marginTop: 14, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: accent, paddingBottom: 2 }}>
      <Text style={{ fontFamily: bold, fontSize: 11.5, color: accent, textTransform: "uppercase", letterSpacing: 1.2 }}>{children}</Text>
    </View>
  );
  return (
    <Shell data={data} page={{ paddingTop: 40, paddingBottom: 40, paddingHorizontal: 46, fontFamily: serif }}>
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontFamily: bold, fontSize: 25, letterSpacing: 0.5 }}>{p.name}</Text>
        {has(p.headline) && <Text style={{ fontSize: 12, fontStyle: "italic", color: soft, marginTop: 3 }}>{p.headline}</Text>}
        <Text style={{ fontSize: 9.5, color: soft, marginTop: 6, textAlign: "center" }}>{contactOf(p).join("   |   ")}</Text>
      </View>

      {has(data.summary) && (
        <>
          <Heading>Profile</Heading>
          <Text style={{ fontSize: 10, lineHeight: 1.5 }}>{data.summary}</Text>
        </>
      )}
      {data.experience.length > 0 && (
        <>
          <Heading>Experience</Heading>
          {data.experience.map((item, index) => (
            <View key={index} wrap={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: bold, fontSize: 11 }}>{item.title}</Text>
                <Text style={{ fontSize: 9.5, color: soft }}>{dateRange(item.start, item.end, item.current)}</Text>
              </View>
              <Text style={{ fontSize: 10, fontStyle: "italic", color: soft }}>{[item.workplace, item.location].filter(has).join(", ")}</Text>
              <Description text={item.description} size={9.5} />
            </View>
          ))}
        </>
      )}
      {data.education.length > 0 && (
        <>
          <Heading>Education</Heading>
          {data.education.map((item, index) => (
            <View key={index} wrap={false} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: bold, fontSize: 11 }}>{item.institution}</Text>
                <Text style={{ fontSize: 9.5, color: soft }}>{dateRange(item.start, item.end, false)}</Text>
              </View>
              <Text style={{ fontSize: 10, color: soft }}>{[[item.degree, item.field].filter(has).join(" in "), item.grade].filter(has).join(" - ")}</Text>
            </View>
          ))}
        </>
      )}
      {data.projects.length > 0 && (
        <>
          <Heading>Projects</Heading>
          {data.projects.map((item, index) => (
            <View key={index} wrap={false} style={{ marginBottom: 6 }}>
              <Text style={{ fontFamily: bold, fontSize: 10.5 }}>{item.name}</Text>
              <ProjectLink value={item.link} color={accent} />
              <Description text={item.description} size={9.5} />
            </View>
          ))}
        </>
      )}
      {data.skills.length > 0 && (
        <>
          <Heading>Skills</Heading>
          <Text style={{ fontSize: 10, lineHeight: 1.5 }}>{data.skills.join("  •  ")}</Text>
        </>
      )}
      {data.certifications.length > 0 && (
        <>
          <Heading>Certifications</Heading>
          {data.certifications.map((item, index) => (
            <Text key={index} style={{ fontSize: 10, marginBottom: 2 }}>
              {[item.title, item.issuer, item.year].filter(has).join(" - ")}
            </Text>
          ))}
        </>
      )}
      {data.languages.length > 0 && (
        <>
          <Heading>Languages</Heading>
          <Text style={{ fontSize: 10 }}>{data.languages.join("  •  ")}</Text>
        </>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ Modern */
function Modern({ data }) {
  const { personal: p, accent } = data;
  const SideTitle = ({ children }) => (
    <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5, color: "#ffffff", textTransform: "uppercase", letterSpacing: 1.3, marginTop: 16, marginBottom: 6, borderBottomWidth: 0.75, borderBottomColor: tint(accent, 0.5), paddingBottom: 3 }}>
      {children}
    </Text>
  );
  const MainTitle = ({ children }) => (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 7 }}>
      <View style={{ width: 4, height: 13, backgroundColor: accent, marginRight: 7 }} />
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, color: ink, textTransform: "uppercase", letterSpacing: 1 }}>{children}</Text>
    </View>
  );
  const light = tint(accent, 0.88);
  return (
    <Shell data={data} page={{ flexDirection: "row" }}>
      <View fixed style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 190, backgroundColor: accent }} />
      <View style={{ width: 190, paddingTop: 40, paddingBottom: 32, paddingHorizontal: 20 }}>
        <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: light, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 24, color: accent }}>{(p.name || "?").trim().charAt(0).toUpperCase()}</Text>
        </View>
        {contactOf(p).length > 0 && <SideTitle>Contact</SideTitle>}
        {contactOf(p).map((row, index) => (
          <Text key={index} style={{ fontSize: 8.8, color: "#ffffff", marginBottom: 4, lineHeight: 1.35 }}>
            {row}
          </Text>
        ))}
        {data.skills.length > 0 && <SideTitle>Skills</SideTitle>}
        {data.skills.map((skill, index) => (
          <Text key={index} style={{ fontSize: 9, color: "#ffffff", marginBottom: 3 }}>
            {skill}
          </Text>
        ))}
        {data.languages.length > 0 && <SideTitle>Languages</SideTitle>}
        {data.languages.map((language, index) => (
          <Text key={index} style={{ fontSize: 9, color: "#ffffff", marginBottom: 3 }}>
            {language}
          </Text>
        ))}
        {data.certifications.length > 0 && <SideTitle>Certifications</SideTitle>}
        {data.certifications.map((item, index) => (
          <View key={index} style={{ marginBottom: 5 }}>
            <Text style={{ fontSize: 9, color: "#ffffff", fontFamily: "Helvetica-Bold" }}>{item.title}</Text>
            <Text style={{ fontSize: 8.3, color: tint(accent, 0.75) }}>{[item.issuer, item.year].filter(has).join(" - ")}</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1, paddingTop: 40, paddingBottom: 32, paddingLeft: 24, paddingRight: 34 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 26, color: ink, lineHeight: 1.1 }}>{p.name}</Text>
        {has(p.headline) && <Text style={{ fontSize: 12, color: accent, marginTop: 4 }}>{p.headline}</Text>}
        {has(data.summary) && (
          <>
            <MainTitle>Profile</MainTitle>
            <Text style={{ fontSize: 9.6, lineHeight: 1.5, color: soft }}>{data.summary}</Text>
          </>
        )}
        {data.experience.length > 0 && <MainTitle>Experience</MainTitle>}
        {data.experience.map((item, index) => (
          <View key={index} wrap={false} style={{ marginBottom: 9 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5 }}>{item.title}</Text>
            <Text style={{ fontSize: 9, color: accent }}>
              {[item.workplace, item.location].filter(has).join(", ")}
              {dateRange(item.start, item.end, item.current) ? `   |   ${dateRange(item.start, item.end, item.current)}` : ""}
            </Text>
            <Description text={item.description} />
          </View>
        ))}
        {data.education.length > 0 && <MainTitle>Education</MainTitle>}
        {data.education.map((item, index) => (
          <View key={index} wrap={false} style={{ marginBottom: 7 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5 }}>{item.institution}</Text>
            <Text style={{ fontSize: 9, color: soft }}>{[[item.degree, item.field].filter(has).join(" in "), item.grade].filter(has).join(" - ")}</Text>
            <Text style={{ fontSize: 8.6, color: accent }}>{dateRange(item.start, item.end, false)}</Text>
          </View>
        ))}
        {data.projects.length > 0 && <MainTitle>Projects</MainTitle>}
        {data.projects.map((item, index) => (
          <View key={index} wrap={false} style={{ marginBottom: 7 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>{item.name}</Text>
            <ProjectLink value={item.link} color={accent} />
            <Description text={item.description} />
          </View>
        ))}
      </View>
    </Shell>
  );
}

/* ------------------------------------------------------------------ Minimal */
function Minimal({ data }) {
  const { personal: p, accent } = data;
  const Row = ({ title, children }) => (
    <View style={{ flexDirection: "row", marginTop: 18 }}>
      <View style={{ width: 96, paddingRight: 10 }}>
        <Text style={{ fontSize: 8, color: faint, textTransform: "uppercase", letterSpacing: 1.6 }}>{title}</Text>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
  const Item = ({ left, children }) => (
    <View wrap={false} style={{ flexDirection: "row", marginBottom: 9 }}>
      <View style={{ width: 0 }} />
      <View style={{ flex: 1 }}>{children}</View>
      {left && <Text style={{ fontSize: 8.5, color: faint, marginLeft: 8, width: 88, textAlign: "right" }}>{left}</Text>}
    </View>
  );
  return (
    <Shell data={data} page={{ paddingTop: 48, paddingBottom: 40, paddingHorizontal: 44 }}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 30, letterSpacing: -0.4 }}>{p.name}</Text>
      <View style={{ width: 34, height: 3, backgroundColor: accent, marginTop: 8, marginBottom: 8 }} />
      {has(p.headline) && <Text style={{ fontSize: 12, color: soft }}>{p.headline}</Text>}
      <Text style={{ fontSize: 9, color: faint, marginTop: 6 }}>{contactOf(p).join("  ·  ")}</Text>

      {has(data.summary) && (
        <Row title="Profile">
          <Text style={{ fontSize: 9.8, lineHeight: 1.6, color: soft }}>{data.summary}</Text>
        </Row>
      )}
      {data.experience.length > 0 && (
        <Row title="Experience">
          {data.experience.map((item, index) => (
            <Item key={index} left={dateRange(item.start, item.end, item.current)}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5 }}>{item.title}</Text>
              <Text style={{ fontSize: 9.2, color: accent }}>{[item.workplace, item.location].filter(has).join(", ")}</Text>
              <Description text={item.description} />
            </Item>
          ))}
        </Row>
      )}
      {data.education.length > 0 && (
        <Row title="Education">
          {data.education.map((item, index) => (
            <Item key={index} left={dateRange(item.start, item.end, false)}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5 }}>{item.institution}</Text>
              <Text style={{ fontSize: 9.2, color: soft }}>{[[item.degree, item.field].filter(has).join(" in "), item.grade].filter(has).join(" - ")}</Text>
            </Item>
          ))}
        </Row>
      )}
      {data.projects.length > 0 && (
        <Row title="Projects">
          {data.projects.map((item, index) => (
            <Item key={index}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.2 }}>{item.name}</Text>
              <ProjectLink value={item.link} color={accent} />
              <Description text={item.description} />
            </Item>
          ))}
        </Row>
      )}
      {data.skills.length > 0 && (
        <Row title="Skills">
          <Text style={{ fontSize: 9.8, lineHeight: 1.6, color: soft }}>{data.skills.join(", ")}</Text>
        </Row>
      )}
      {data.languages.length > 0 && (
        <Row title="Languages">
          <Text style={{ fontSize: 9.8, color: soft }}>{data.languages.join(", ")}</Text>
        </Row>
      )}
      {data.certifications.length > 0 && (
        <Row title="Certificates">
          {data.certifications.map((item, index) => (
            <Text key={index} style={{ fontSize: 9.6, color: soft, marginBottom: 3 }}>
              {[item.title, item.issuer, item.year].filter(has).join(" - ")}
            </Text>
          ))}
        </Row>
      )}
    </Shell>
  );
}

/* ---------------------------------------------------------------- Executive */
function Executive({ data }) {
  const { personal: p, accent } = data;
  const band = darken(accent, 0.25);
  const Title = ({ children, side }) => (
    <Text style={{ fontFamily: "Helvetica-Bold", fontSize: side ? 9.5 : 11, color: side ? band : band, textTransform: "uppercase", letterSpacing: 1.2, marginTop: 14, marginBottom: 6, borderBottomWidth: 1.2, borderBottomColor: accent, paddingBottom: 3 }}>
      {children}
    </Text>
  );
  return (
    <Shell data={data} page={{ paddingBottom: 0 }}>
      <View style={{ backgroundColor: band, paddingTop: 34, paddingBottom: 24, paddingHorizontal: 36 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 27, color: "#ffffff", letterSpacing: 0.4 }}>{p.name}</Text>
        {has(p.headline) && <Text style={{ fontSize: 12, color: tint(accent, 0.7), marginTop: 4 }}>{p.headline}</Text>}
      </View>
      <View style={{ flexDirection: "row", flex: 1 }}>
        <View style={{ flex: 1, paddingTop: 6, paddingBottom: 30, paddingLeft: 36, paddingRight: 20 }}>
          {has(data.summary) && (
            <>
              <Title>Professional profile</Title>
              <Text style={{ fontSize: 9.6, lineHeight: 1.5, color: soft }}>{data.summary}</Text>
            </>
          )}
          {data.experience.length > 0 && <Title>Experience</Title>}
          {data.experience.map((item, index) => (
            <View key={index} wrap={false} style={{ marginBottom: 9 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5, flex: 1 }}>{item.title}</Text>
                <Text style={{ fontSize: 8.6, color: soft }}>{dateRange(item.start, item.end, item.current)}</Text>
              </View>
              <Text style={{ fontSize: 9.2, color: accent }}>{[item.workplace, item.location].filter(has).join(", ")}</Text>
              <Description text={item.description} />
            </View>
          ))}
          {data.projects.length > 0 && <Title>Projects</Title>}
          {data.projects.map((item, index) => (
            <View key={index} wrap={false} style={{ marginBottom: 7 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>{item.name}</Text>
              <ProjectLink value={item.link} color={accent} />
              <Description text={item.description} />
            </View>
          ))}
        </View>
        <View style={{ width: 178, backgroundColor: tint(accent, 0.93), paddingTop: 6, paddingBottom: 30, paddingHorizontal: 16 }}>
          {contactOf(p).length > 0 && <Title side>Contact</Title>}
          {contactOf(p).map((row, index) => (
            <Text key={index} style={{ fontSize: 8.8, color: soft, marginBottom: 4, lineHeight: 1.35 }}>
              {row}
            </Text>
          ))}
          {data.education.length > 0 && <Title side>Education</Title>}
          {data.education.map((item, index) => (
            <View key={index} wrap={false} style={{ marginBottom: 7 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.4 }}>{item.institution}</Text>
              <Text style={{ fontSize: 8.6, color: soft }}>{[[item.degree, item.field].filter(has).join(" in "), item.grade].filter(has).join(" - ")}</Text>
              <Text style={{ fontSize: 8.2, color: faint }}>{dateRange(item.start, item.end, false)}</Text>
            </View>
          ))}
          {data.skills.length > 0 && <Title side>Skills</Title>}
          {data.skills.map((skill, index) => (
            <Text key={index} style={{ fontSize: 9, color: soft, marginBottom: 3 }}>
              {skill}
            </Text>
          ))}
          {data.languages.length > 0 && <Title side>Languages</Title>}
          {data.languages.map((language, index) => (
            <Text key={index} style={{ fontSize: 9, color: soft, marginBottom: 3 }}>
              {language}
            </Text>
          ))}
          {data.certifications.length > 0 && <Title side>Certifications</Title>}
          {data.certifications.map((item, index) => (
            <View key={index} style={{ marginBottom: 5 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.8 }}>{item.title}</Text>
              <Text style={{ fontSize: 8.2, color: soft }}>{[item.issuer, item.year].filter(has).join(" - ")}</Text>
            </View>
          ))}
        </View>
      </View>
    </Shell>
  );
}

/* ----------------------------------------------------------------- Creative */
function Creative({ data }) {
  const { personal: p, accent } = data;
  const Title = ({ children }) => (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 8 }}>
      <View style={{ width: 9, height: 9, backgroundColor: accent, marginRight: 7, transform: "rotate(45deg)" }} />
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, color: accent, textTransform: "uppercase", letterSpacing: 1.1 }}>{children}</Text>
    </View>
  );
  const Chip = ({ children }) => (
    <Text style={{ fontSize: 8.8, color: accent, borderWidth: 0.9, borderColor: accent, borderRadius: 9, paddingVertical: 2.5, paddingHorizontal: 8, marginRight: 5, marginBottom: 5 }}>{children}</Text>
  );
  return (
    <Shell data={data} page={{ paddingTop: 38, paddingBottom: 36, paddingHorizontal: 40 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: accent, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 22, color: "#ffffff" }}>
            {(p.name || "?")
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part.charAt(0).toUpperCase())
              .join("")}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 25, color: ink }}>{p.name}</Text>
          {has(p.headline) && <Text style={{ fontSize: 11.5, color: accent }}>{p.headline}</Text>}
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10, paddingVertical: 6, borderTopWidth: 0.8, borderBottomWidth: 0.8, borderColor: tint(accent, 0.6) }}>
        {contactOf(p).map((row, index) => (
          <Text key={index} style={{ fontSize: 9, color: soft, marginRight: 14 }}>
            {row}
          </Text>
        ))}
      </View>

      {has(data.summary) && (
        <>
          <Title>About me</Title>
          <Text style={{ fontSize: 9.8, lineHeight: 1.55, color: soft }}>{data.summary}</Text>
        </>
      )}
      {data.experience.length > 0 && <Title>Experience</Title>}
      {data.experience.map((item, index) => (
        <View key={index} wrap={false} style={{ flexDirection: "row", marginBottom: 10 }}>
          <View style={{ width: 14, alignItems: "center" }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent, marginTop: 3 }} />
            <View style={{ width: 1.2, flex: 1, backgroundColor: tint(accent, 0.65), marginTop: 2 }} />
          </View>
          <View style={{ flex: 1, paddingLeft: 6 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.8 }}>{item.title}</Text>
            <Text style={{ fontSize: 9, color: accent }}>
              {[item.workplace, item.location].filter(has).join(", ")}
              {dateRange(item.start, item.end, item.current) ? `  ·  ${dateRange(item.start, item.end, item.current)}` : ""}
            </Text>
            <Description text={item.description} />
          </View>
        </View>
      ))}
      {data.education.length > 0 && <Title>Education</Title>}
      {data.education.map((item, index) => (
        <View key={index} wrap={false} style={{ marginBottom: 7 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5 }}>{item.institution}</Text>
          <Text style={{ fontSize: 9.2, color: soft }}>
            {[[item.degree, item.field].filter(has).join(" in "), item.grade].filter(has).join(" - ")}
            {dateRange(item.start, item.end, false) ? `  ·  ${dateRange(item.start, item.end, false)}` : ""}
          </Text>
        </View>
      ))}
      {data.projects.length > 0 && <Title>Projects</Title>}
      {data.projects.map((item, index) => (
        <View key={index} wrap={false} style={{ marginBottom: 7 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.3 }}>{item.name}</Text>
          <ProjectLink value={item.link} color={accent} />
          <Description text={item.description} />
        </View>
      ))}
      {data.skills.length > 0 && (
        <>
          <Title>Skills</Title>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {data.skills.map((skill, index) => (
              <Chip key={index}>{skill}</Chip>
            ))}
          </View>
        </>
      )}
      {data.languages.length > 0 && (
        <>
          <Title>Languages</Title>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {data.languages.map((language, index) => (
              <Chip key={index}>{language}</Chip>
            ))}
          </View>
        </>
      )}
      {data.certifications.length > 0 && (
        <>
          <Title>Certifications</Title>
          {data.certifications.map((item, index) => (
            <Text key={index} style={{ fontSize: 9.6, color: soft, marginBottom: 3 }}>
              {[item.title, item.issuer, item.year].filter(has).join(" - ")}
            </Text>
          ))}
        </>
      )}
    </Shell>
  );
}

const layouts = { classic: Classic, modern: Modern, minimal: Minimal, executive: Executive, creative: Creative };

/** The PDF document for a template and CV data. */
export function CvDocument({ template, data }) {
  const Layout = layouts[template] || Classic;
  return <Layout data={data} />;
}
