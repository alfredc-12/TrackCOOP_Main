import JSZip from "jszip";
import type {
  RfmHistory,
  RfmWorkspace,
} from "./member-indicator.workspace-types";

type Cell = string | number | null | { value: number; style: number };
const xml = (value: unknown) =>
  String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(
      /[<>&"']/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    );
export function safeSpreadsheetText(value: string) {
  return /^[\s]*[=+@\-]/.test(value) || /^[\t\r\n]/.test(value)
    ? `'${value}`
    : value;
}
function columnName(index: number): string {
  return index < 26
    ? String.fromCharCode(65 + index)
    : columnName(Math.floor(index / 26) - 1) + columnName(index % 26);
}
function sheet(rows: Cell[][]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${Array.from({ length: Math.max(...rows.map((r) => r.length)) }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="24" customWidth="1"/>`).join("")}</cols><sheetData>${rows
    .map(
      (row, i) =>
        `<row r="${i + 1}">${row
          .map((cell, j) => {
            const ref = `${columnName(j)}${i + 1}`;
            if (cell == null) return `<c r="${ref}"/>`;
            if (typeof cell === "object")
              return `<c r="${ref}" s="${cell.style}"><v>${cell.value}</v></c>`;
            if (typeof cell === "number" && Number.isFinite(cell))
              return `<c r="${ref}"><v>${cell}</v></c>`;
            return `<c r="${ref}" t="inlineStr"${i === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${xml(safeSpreadsheetText(String(cell)))}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join(
      "",
    )}</sheetData><autoFilter ref="A1:${columnName(rows[0].length - 1)}${rows.length}"/></worksheet>`;
}
const dateCell = (value: string | null): Cell =>
  value
    ? {
        value:
          Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value) /
            86400000 +
          25569,
        style: value.length === 10 ? 3 : 4,
      }
    : null;
export async function createRfmWorkbook(
  sheets: Array<{ name: string; rows: Cell[][] }>,
) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file(
    "xl/styles.xml",
    '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;PHP &quot;#,##0.00"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/><numFmt numFmtId="166" formatCode="yyyy-mm-dd hh:mm:ss &quot;UTC&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf xfId="0"/><xf fontId="1" xfId="0" applyFont="1"/><xf numFmtId="164" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
  );
  sheets.forEach((s, i) =>
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheet(s.rows)),
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
export function rfmResultRows(rows: RfmHistory["rows"]): Cell[][] {
  return [
    [
      "Member code",
      "Member name",
      "Membership type",
      "Official membership status",
      "Advisory RFM classification",
      "Recency days",
      "Frequency count",
      "Validated contributions (PHP)",
      "R score",
      "F score",
      "C score",
      "Total score",
      "Basis start",
      "Basis end",
      "Scoring version",
      "Calculated at (UTC)",
      "Quality",
      "Configuration fingerprint",
      "Calculated by",
      "Saved indicator ID",
    ],
    ...rows.map((r) => [
      r.memberCode,
      r.fullName,
      r.membershipType,
      r.officialMemberStatus,
      r.classification ?? "Not Yet Scored",
      r.recencyDays,
      r.frequencyCount,
      r.validatedShareCapital == null
        ? null
        : { value: r.validatedShareCapital, style: 2 },
      r.recencyScore,
      r.frequencyScore,
      r.contributionScore,
      r.totalScore,
      dateCell(r.basisStart),
      dateCell(r.basisEnd),
      r.scoringVersion,
      dateCell(r.computedAt),
      r.quality,
      r.configurationFingerprint,
      r.computedBy,
      r.indicatorId,
    ]),
  ];
}
export function exportRfmWorkspace(data: RfmWorkspace) {
  return createRfmWorkbook([
    {
      name: "RFM Summary",
      rows: [
        ["Measure", "Value"],
        [
          "Report",
          "Advisory engagement indicators; not official membership-status certification",
        ],
        ["Generated at (UTC)", dateCell(data.generatedAt)],
        ["Selected context", data.filters.context],
        ["Selected filters", JSON.stringify(data.filters)],
        ["Eligible filtered population", data.summary.eligible],
        ["Scored", data.summary.scored],
        ["Not yet scored", data.summary.notScored],
        ["Coverage (%)", data.summary.coverage],
        ["Active RFM", data.summary.active],
        ["Needs Monitoring RFM", data.summary.needsMonitoring],
        ["Inactive RFM", data.summary.inactive],
        ["Average score", data.summary.average],
        ["Median score", data.summary.median],
        ["Latest calculation", dateCell(data.summary.latestCalculation)],
        ["Basis periods", JSON.stringify(data.summary.basisPeriods)],
      ],
    },
    { name: "Member Indicator Results", rows: rfmResultRows(data.rows) },
    {
      name: "Component Distribution",
      rows: [
        [
          "Component",
          "Score",
          "Members",
          "% of scored population",
          "Average",
          "Median",
        ],
        ...data.components.flatMap((c) =>
          c.distribution.map((d) => [
            c.component,
            d.score,
            d.count,
            d.percentage,
            c.average,
            c.median,
          ]),
        ),
      ],
    },
    {
      name: "Comparison Matrix",
      rows: [
        [
          "Recency score",
          "Frequency score",
          "Distinct members",
          "% of scored population",
          "C1",
          "C2",
          "C3",
          "C4",
          "C5",
        ],
        ...data.matrix.map((c) => [
          c.recency,
          c.frequency,
          c.count,
          c.percentage,
          ...c.contributions,
        ]),
      ],
    },
    {
      name: "Methodology",
      rows: [
        ["Definition", "Value"],
        [
          "Effective configuration for NEW calculations",
          JSON.stringify(data.settings),
        ],
        [
          "Saved settings",
          "Each result retains its original configuration when available. Current settings are not historical settings.",
        ],
        [
          "Formula",
          "Total = Recency + Frequency + Contribution (3–15). Configured thresholds take precedence.",
        ],
        [
          "Eligibility",
          "Approved member profiles with official status Active or Inactive. Pending, Suspended and Terminated profiles excluded.",
        ],
        [
          "Frequency",
          "Qualifying participation records inside the inclusive rolling 12-month period. No POS or rental spending.",
        ],
        [
          "Contribution",
          "Validated non-reversal share-capital payments through basis end; excludes ledger interest and adjustments.",
        ],
        [
          "Safeguard",
          "Inactive when frequency is zero and last qualifying participation is absent or over 365 days ago.",
        ],
        [
          "Snapshot selection",
          "Latest basis end, then calculation timestamp, then ID; historical contexts require exact basis/run.",
        ],
        [
          "Freshness",
          "Basis before today is potentially outdated, not proven stale. Source freshness is not independently verified.",
        ],
        [
          "Legacy records",
          "Original source evidence/configuration is unavailable unless preserved at calculation time.",
        ],
        [
          "Duplicate policy",
          "Identical member/basis/configuration/source results are skipped. Changed results append history.",
        ],
        ["Selected filters", JSON.stringify(data.filters)],
      ],
    },
    {
      name: "Data Coverage",
      rows: [
        ["Category", "Value", "Scored", "Coverage (%)"],
        ...data.summary.quality.map((q) => [q.status, q.count, null, null]),
        ...data.summary.byType.map((t) => [
          t.type,
          t.eligible,
          t.scored,
          t.coverage,
        ]),
        ...data.summary.versions.map((v) => [v.version, v.count, null, null]),
      ],
    },
  ]);
}
