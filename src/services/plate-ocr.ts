import { recognizeText } from 'rn-mlkit-ocr';

export function normalizePlateCandidate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
}

export function selectPlateCandidate(text: string) {
  const candidates = text
    .split(/\r?\n|\s{2,}/)
    .map(normalizePlateCandidate)
    .filter((value) => value.length >= 3 && value.length <= 15);
  return candidates.sort((a, b) => {
    const score = (value: string) => (value.length === 6 ? 4 : 0) + (/[A-Z]/.test(value) ? 2 : 0) + (/\d/.test(value) ? 2 : 0);
    return score(b) - score(a);
  })[0] ?? '';
}

export async function recognizePlateFromImage(imageUri: string) {
  const result = await recognizeText(imageUri, 'latin');
  return { rawText: result.text, candidate: selectPlateCandidate(result.text) };
}
