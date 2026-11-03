import { test } from "node:test"
import assert from "node:assert/strict"
import { buildDocument, lineText } from "../services/extract/document.js"

const kinds = (text: string) => buildDocument(text).map((l) => l.kind)

test("lines holding only <<page>> or a form feed are page breaks, never text", () => {
  const doc = buildDocument(
    "Age: 40\n<<page>>\nA1c: 8.1 %\n\f\nDose: 0.5 mg weekly\n",
  )
  assert.deepEqual(
    doc.map((l) => [l.kind, l.page]),
    [
      ["field", 1],
      ["page-break", 1],
      ["field", 2],
      ["page-break", 2],
      ["field", 3],
      ["blank", 3],
    ],
  )
})

test("key-value fields read ':', '|', '?', '=' and ' - ' separators", () => {
  const doc = buildDocument(
    "Age: 40\nDx | type 2 diabetes\nWhat strength? 0.5 mg\nA1C = 8.1%\nPlan - semaglutide 0.5 mg weekly\n",
  )
  assert.deepEqual(
    doc.slice(0, 5).map((l) => [l.kind, l.role, l.value]),
    [
      ["field", "age", "40"],
      ["field", "indication", "type 2 diabetes"],
      ["field", "amountOnly", "0.5 mg"],
      ["field", "labs", "8.1%"],
      ["field", "dose", "semaglutide 0.5 mg weekly"],
    ],
  )
})

test("pipe and aligned tables bind each cell to its header", () => {
  const pipe = buildDocument("Test | Result | Date\nA1c | 8.6% | [date-a]\n")
  assert.equal(pipe[0].kind, "table-header")
  assert.deepEqual(
    pipe[1].cells!.map((c) => [c.header, c.text]),
    [
      ["test", "A1c"],
      ["result", "8.6%"],
      ["date", "[date-a]"],
    ],
  )
  const aligned = buildDocument(
    "Drug        Dose          Start\nmetformin   1000 mg BID   [date-a]\n",
  )
  assert.equal(aligned[1].kind, "table-row")
  assert.deepEqual(
    aligned[1].cells!.map((c) => c.header),
    ["drug", "dose", "start"],
  )
})

test("checkboxes keep their state, one box or several on a line", () => {
  const doc = buildDocument(
    "[x] Type 2 diabetes\n[ ] Obesity\nDiagnosis: [x] T2DM [ ] T1DM\n",
  )
  assert.equal(doc[0].checked, "checked")
  assert.equal(doc[1].checked, "unchecked")
  assert.deepEqual(
    doc[2].options!.map((o) => [o.text, o.checked]),
    [
      ["T2DM", "checked"],
      ["T1DM", "unchecked"],
    ],
  )
})

test("a scanned box read as '[ 1' or '[]1' is still a box before its label", () => {
  const doc = buildDocument(
    "[ 1 A1c attachment: ____\n[]1LDL-C result attached:\n",
  )
  assert.deepEqual(
    doc.slice(0, 2).map((l) => [l.kind, l.checked, l.label]),
    [
      ["field", "unclear", "A1c attachment"],
      ["field", "unchecked", "LDL-C result attached"],
    ],
  )
})

test("question and answer pairs and SOAP parts carry their roles", () => {
  const qa = buildDocument("Q: What is the patient's age?\nA: 52\n")
  assert.equal(qa[1].label, "What is the patient's age?")
  const soap = buildDocument(
    "A: type 2 diabetes, above goal\nP: semaglutide 0.5 mg weekly\n",
  )
  assert.deepEqual(
    soap.slice(0, 2).map((l) => [l.soap, l.role]),
    [
      ["A", "assessment"],
      ["P", "dose"],
    ],
  )
})

test("a value that wraps onto the next line is joined and both lines stay citable", () => {
  const doc = buildDocument(
    "Indication for this request: moderate to severe plaque\npsoriasis, BSA 14%.\nAge: 40\n",
  )
  assert.equal(doc[1].kind, "continuation")
  assert.deepEqual(doc[0].joined, [1])
  assert.equal(
    lineText(doc[0]),
    "Indication for this request: moderate to severe plaque psoriasis, BSA 14%.",
  )
})

test("a field with an empty value heads the list under it", () => {
  const doc = buildDocument(
    "Diagnosis for this request:\n[x] Type 2 diabetes\n[ ] Obesity\n",
  )
  assert.deepEqual(
    kinds("Diagnosis for this request:\n[x] Type 2 diabetes\n"),
    ["heading", "prose", "blank"],
  )
  assert.equal(doc[1].section.fieldRole, "indication")
})
