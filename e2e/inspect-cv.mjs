// Makes one CV per template from sample data and saves the PDFs to artifacts/cv/, so the layouts can be looked at.
// Needs a running stack:  node run.mjs --stack-only   (then, in another terminal)  node inspect-cv.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { By, click, find, go, openBrowser, signIn, visible, waitText, xText } from "./lib/browser.mjs";
import { makeLearner } from "./lib/factory.mjs";
import { paths, urls } from "./lib/config.mjs";
import { PASSWORD } from "./lib/config.mjs";
import { TEMPLATES } from "./../frontend/lib/cv-data.js";

const sample = (accent) => ({
  accent,
  personal: { name: "Nusrat Jahan Rima", headline: "Full-stack web developer", email: "nusrat.rima@example.com", phone: "+880 1712 345678", address: "House 12, Road 5, Dhanmondi, Dhaka", website: "https://nusrat.dev" },
  summary: "Self-driven developer with three years of experience building web products people enjoy using. I like clear interfaces, honest estimates and code that the next person can read. Looking for a team that ships often and learns from what it ships.",
  experience: [
    { title: "Frontend Developer", workplace: "Acme Technologies Ltd", location: "Dhaka", start: "2022-03", end: "", current: true, description: "Rebuilt the customer dashboard in React, cutting load time by 40%\nLed a team of three through two product launches\nIntroduced automated testing that caught regressions before release" },
    { title: "Junior Web Developer", workplace: "Pixel Studio", location: "Remote", start: "2020-06", end: "2022-02", current: false, description: "Built landing pages and admin tools for twelve clients.\nMentored two interns." },
    { title: "Intern", workplace: "Startup Hub", location: "Chattogram", start: "2019-09", end: "2020-03", current: false, description: "" },
  ],
  education: [
    { institution: "University of Dhaka", degree: "BSc", field: "Computer Science and Engineering", start: "2015-01", end: "2019-06", grade: "CGPA 3.72 / 4.00" },
    { institution: "Dhaka College", degree: "HSC", field: "Science", start: "2013-07", end: "2015-06", grade: "GPA 5.00" },
  ],
  skills: ["JavaScript", "React", "Node.js", "PostgreSQL", "Tailwind CSS", "Git", "REST APIs", "Figma", "Public speaking", "Team leadership"],
  languages: ["Bangla (native)", "English (fluent)", "Hindi (basic)"],
  projects: [
    { name: "Uddeepto skill platform", link: "https://uddeepto.kodofact.com", description: "A learning and hiring platform with courses, contests and a CV generator." },
    { name: "Open-source charts", link: "github.com/nusrat/mini-charts", description: "Tiny accessible chart library used by 300+ projects." },
  ],
  certifications: [
    { title: "AWS Cloud Practitioner", issuer: "Amazon Web Services", year: "2023" },
    { title: "Responsive Web Design", issuer: "freeCodeCamp", year: "2021" },
  ],
});

const accents = { classic: "#19704f", modern: "#1d4ed8", minimal: "#7c3aed", executive: "#be123c", creative: "#e77b38" };
const out = path.join(paths.artifacts, "cv");
mkdirSync(out, { recursive: true });

const driver = await openBrowser();
try {
  const me = await makeLearner("cvlook", "web", "data");
  await signIn(driver, me);
  for (const { id } of TEMPLATES) {
    const draft = { template: id, data: sample(accents[id]) };
    await go(driver, "/cv");
    await visible(driver, By.css(".cvg-template"));
    await driver.executeScript("localStorage.setItem(arguments[0], arguments[1])", `uddeepto-cv-draft:${me.id}`, JSON.stringify(draft));
    await driver.navigate().refresh();
    await visible(driver, By.css(".cvg-template"));
    await click(driver, xText("Save as my CV", { tag: "button" }));
    await waitText(driver, "CV saved.");
    const login = await fetch(`${urls.api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: me.username, password: PASSWORD }) });
    const { accessToken } = await login.json();
    const file = await fetch(`${urls.api}/frontend/cv/file`, { headers: { Authorization: `Bearer ${accessToken}` } });
    writeFileSync(path.join(out, `${id}.pdf`), Buffer.from(await file.arrayBuffer()));
    console.log(`saved ${id}.pdf`);
  }
} finally {
  await driver.quit();
}
