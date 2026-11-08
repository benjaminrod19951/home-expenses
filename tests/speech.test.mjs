import { test } from "node:test";
import assert from "node:assert/strict";
import { hebrewNumber, parseQuickEntries, stripNumberPrefix } from "../src/lib/speech.js";

const cats = ["סופר", "רכב ותחבורה", "מסעדות ומשלוחים", "אחר"];
const amounts = text => parseQuickEntries(text, cats, [], []).map(x => x.amount);

test("Hebrew number words", () => {
  assert.equal(hebrewNumber("מאה עשרים וחמישה"), 125);
  assert.equal(hebrewNumber("אלף ומאתיים"), 1200);
  assert.equal(hebrewNumber("שלוש מאות"), 300);
  assert.equal(hebrewNumber("עשרים ואחד"), 21);
});
test("number with a prefix: 'במאה' (bug: used to give 25 instead of 125)", () => {
  assert.deepEqual(amounts("קניתי בשופרסל במאה עשרים וחמישה שקלים"), [125]);
  assert.deepEqual(amounts("דלק בשלוש מאות שקל"), [300]);
});
test("prefix is removed only from number words", () => {
  assert.equal(stripNumberPrefix("במאה"), "מאה");
  assert.equal(stripNumberPrefix("בשופרסל"), "בשופרסל");
});
test("several entries with digits", () => {
  assert.deepEqual(amounts("סופר 120 שקל, דלק 250"), [120, 250]);
});
