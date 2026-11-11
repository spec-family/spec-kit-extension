// Splits a bill between people in whole cents. The cents that do not divide
// evenly go one each to the first people, so the shares add up to the bill
// and no two differ by more than a cent.
export function splitBill(totalCents, people) {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new RangeError('a bill is a whole number of cents, 0 or more');
  }
  if (!Number.isInteger(people) || people < 1) {
    throw new RangeError('a bill is split between 1 or more people');
  }
  const share = Math.floor(totalCents / people);
  const left = totalCents - share * people;
  return Array.from({ length: people }, (_, i) => share + (i < left ? 1 : 0));
}
