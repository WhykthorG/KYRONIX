export {
  assertSafeIdentifier,
  isSafeIdentifier,
  uniqueSafeIdentifiers,
} from '@shared/contracts/dbIdentifiers';

export function normalizeSearchText(value) {
  return String(value ?? '').trim();
}

export function dedupeRecordsById(records = []) {
  const seen = new Set();

  return records.filter((record) => {
    const recordId = record?.id;
    if (!recordId || seen.has(recordId)) {
      return false;
    }

    seen.add(recordId);
    return true;
  });
}

export function sortRecordsByColumn(records = [], column, ascending = true) {
  const direction = ascending ? 1 : -1;

  return [...records].sort((left, right) => {
    const leftValue = left?.[column];
    const rightValue = right?.[column];

    if (leftValue === rightValue) return 0;
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;

    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return (leftValue - rightValue) * direction;
    }

    return String(leftValue).localeCompare(String(rightValue), 'pt-BR') * direction;
  });
}
