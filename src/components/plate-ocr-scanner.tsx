import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SICAFColors as colors } from '@/constants/theme';
import { normalizePlateCandidate, recognizePlateFromImage } from '@/services/plate-ocr';

type Props = { onApprove: (plate: string, photoUri: string) => void; onCancel: () => void };

export function PlateOcrScanner({ onApprove, onCancel }: Props) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false); const [processing, setProcessing] = useState(false);
  const [photoUri, setPhotoUri] = useState(''); const [plate, setPlate] = useState('');
  const [rawText, setRawText] = useState(''); const [error, setError] = useState('');

  async function capture() {
    if (!camera.current || !ready) return;
    setProcessing(true); setError('');
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) throw new Error('No fue posible guardar la fotografía.');
      setPhotoUri(photo.uri);
      const recognized = await recognizePlateFromImage(photo.uri);
      setPlate(recognized.candidate); setRawText(recognized.rawText);
      if (!recognized.candidate) setError('No se detectó una placa válida. Puede corregir el texto o repetir la fotografía.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible reconocer la placa'); }
    finally { setProcessing(false); }
  }

  async function processImage(uri: string) {
    setProcessing(true); setError('');
    try {
      setPhotoUri(uri);
      const recognized = await recognizePlateFromImage(uri);
      setPlate(recognized.candidate); setRawText(recognized.rawText);
      if (!recognized.candidate) setError('No se detectó una placa válida. Puede corregir el texto o seleccionar otra fotografía.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible reconocer la placa seleccionada'); }
    finally { setProcessing(false); }
  }

  async function selectFromGallery() {
    setError('');
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) { setError('No se concedió permiso para seleccionar fotografías. Puede usar la cámara o habilitar el permiso desde Ajustes.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.9 });
    if (!result.canceled && result.assets[0]?.uri) await processImage(result.assets[0].uri);
  }

  if (!permission) return <View style={styles.center}><ActivityIndicator color={colors.primary}/></View>;
  if (!permission.granted) return <View style={styles.center}><Text style={styles.title}>Permiso de cámara</Text><Text style={styles.description}>SICAF necesita la cámara para reconocer la placa. No conserva la fotografía después de la operación.</Text><Pressable onPress={() => void requestPermission()} style={styles.primary}><Text style={styles.primaryText}>Permitir cámara</Text></Pressable><Pressable onPress={onCancel} style={styles.secondary}><Text style={styles.secondaryText}>Cancelar</Text></Pressable></View>;

  return <View style={styles.container}>
    {!photoUri ? <><View style={styles.cameraWrapper}><CameraView ref={camera} facing="back" onCameraReady={() => setReady(true)} style={StyleSheet.absoluteFill}/><View pointerEvents="none" style={styles.overlay}><View style={styles.guide}/><Text style={styles.guideText}>Centre la placa dentro del recuadro</Text></View></View><Pressable disabled={!ready || processing} onPress={() => void capture()} style={styles.primary}>{processing ? <ActivityIndicator color="#fff"/> : <Text style={styles.primaryText}>Capturar placa</Text>}</Pressable><Pressable disabled={processing} onPress={() => void selectFromGallery()} style={styles.secondary}><Text style={styles.secondaryText}>Seleccionar desde galería</Text></Pressable><Text style={styles.description}>Si la cámara no está disponible, puede seleccionar una fotografía existente. En ambos casos deberá revisar y aprobar la placa.</Text></> : <><Image source={{ uri: photoUri }} resizeMode="contain" style={styles.preview}/><Text style={styles.reviewTitle}>Revise la placa detectada</Text><Text style={styles.description}>Corrija cualquier carácter antes de aprobar. Todavía no se ha consultado ni registrado ningún movimiento.</Text><TextInput autoCapitalize="characters" value={plate} onChangeText={(value) => setPlate(normalizePlateCandidate(value))} placeholder="Placa detectada" placeholderTextColor={colors.muted} style={styles.input}/>{rawText ? <Text style={styles.rawText}>Texto reconocido: {rawText.replace(/\s+/g, ' ').trim()}</Text> : null}<Pressable disabled={plate.length < 3} onPress={() => onApprove(plate, photoUri)} style={styles.primary}><Text style={styles.primaryText}>Aprobar y buscar placa</Text></Pressable><Pressable onPress={() => { setPhotoUri(''); setPlate(''); setRawText(''); setError(''); }} style={styles.secondary}><Text style={styles.secondaryText}>Usar otra fotografía</Text></Pressable></>}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Pressable onPress={onCancel} style={styles.secondary}><Text style={styles.secondaryText}>Cancelar OCR</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, gap: 12, backgroundColor: colors.background }, center: { flex: 1, justifyContent: 'center', padding: 24, gap: 14, backgroundColor: colors.background },
  cameraWrapper: { flex: 1, minHeight: 420, borderRadius: 18, overflow: 'hidden' }, overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.18)' }, guide: { width: '84%', height: 120, borderWidth: 3, borderColor: '#fff', borderRadius: 12 }, guideText: { marginTop: 16, color: '#fff', fontWeight: '800', textShadowColor: '#000', textShadowRadius: 4 },
  preview: { width: '100%', height: 320, borderRadius: 16, backgroundColor: '#102F3D' }, title: { color: colors.text, fontSize: 24, fontWeight: '800' }, reviewTitle: { color: colors.text, fontSize: 20, fontWeight: '800' }, description: { color: colors.muted, fontSize: 14, lineHeight: 21 }, input: { padding: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: '#fff', color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: 2, textAlign: 'center' }, rawText: { color: colors.muted, fontSize: 11 },
  primary: { minHeight: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.primary }, primaryText: { color: '#fff', fontWeight: '800' }, secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: '#fff' }, secondaryText: { color: colors.primary, fontWeight: '700' }, error: { padding: 12, borderRadius: 10, color: '#9A2D25', backgroundColor: '#FBE9E7' },
});
