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

const cats2 = ["סופר", "רכב ותחבורה", "מנויים", "בעלי חיים", "תינוק", "אחר"];
const parse2 = (t, rules = []) => parseQuickEntries(t, cats2, rules, []).map(r => [r.amount, r.merchant, r.category]);

test("regression: amounts of 1000+ in digits are read fully (was 9000 -> 900)", () => {
  assert.deepEqual(amounts("קיבלתי משכורת 9000 שקל"), [9000]);
  assert.deepEqual(amounts("שכירות 4500"), [4500]);
  assert.deepEqual(amounts("1,200 שקל"), [1200]);
  assert.deepEqual(amounts("קפה 12.50 שקל"), [12.5]);
});
test("regression: amount first, then item and category (the real recording)", () => {
  assert.deepEqual(parse2("150 שקל, טיטולים, תינוק, 250 שקל, נירים, תינוק"), [[150, "טיטולים", "תינוק"], [250, "נירים", "תינוק"]]);
});
test("item first, amount last", () => {
  assert.deepEqual(parse2("טיטולים, תינוק, 150 שקל")[0], [150, "טיטולים", "תינוק"]);
});
test("'קטגוריה X' after the amount stays with the same entry", () => {
  assert.deepEqual(parse2("טיטולים 150 שקל קטגוריה תינוק, נירים 250 שקל קטגוריה תינוק"), [[150, "טיטולים", "תינוק"], [250, "נירים", "תינוק"]]);
  assert.deepEqual(parse2("סופר 350 שקל קטגוריה סופר, דאג 50 שקל קטגוריה בעלי חיים"), [[350, "סופר", "סופר"], [50, "דאג", "בעלי חיים"]]);
});
test("regression: an empty description no longer matches every merchant rule (got 'מנויים')", () => {
  const rows = parse2("150 שקל", [{ merchant_key: "נטפליקס", category: "מנויים" }]);
  assert.notEqual(rows[0][2], "מנויים");
});
test("regression: Hebrew filler words are removed from the description (JS \\b ignores Hebrew)", () => {
  const [row] = parse2("שילמתי במזומן בשופרסל במאה עשרים וחמישה שקלים");
  assert.equal(row[0], 125);
  assert.ok(!/שילמתי|במזומן|במאה|וחמישה/.test(row[1]), row[1]);
});
