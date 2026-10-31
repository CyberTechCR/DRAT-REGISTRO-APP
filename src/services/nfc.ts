import NfcManager, { NfcTech } from 'react-native-nfc-manager';

export function normalizeNfcUid(value: string) {
  return value.replace(/[^0-9A-F]/gi, '').toUpperCase();
}

let activeRead: Promise<string> | null = null;

async function performPhysicalNfcRead() {
  const supported = await NfcManager.isSupported();
  if (!supported) throw new Error('Este teléfono no es compatible con NFC.');
  await NfcManager.start();
  await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  const enabled = await NfcManager.isEnabled();
  if (!enabled) throw new Error('Active el NFC del teléfono antes de continuar.');

  let requested = false;
  try {
    requested = true;
    await NfcManager.requestTechnology(NfcTech.NfcA, {
      alertMessage: 'Acerque el gafete NFC al teléfono',
    });
    const tag = await NfcManager.getTag();
    const uid = tag?.id ? normalizeNfcUid(tag.id) : '';
    if (!uid) throw new Error('La etiqueta no proporcionó un identificador NFC.');
    return uid;
  } finally {
    if (requested) await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}

export async function readPhysicalNfcUid() {
  if (activeRead) return activeRead;
  activeRead = performPhysicalNfcRead();
  try { return await activeRead; }
  finally { activeRead = null; }
}
