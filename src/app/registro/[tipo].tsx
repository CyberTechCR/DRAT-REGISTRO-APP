import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SICAFColors as colors } from '@/constants/theme';
import { useSession } from '@/auth/SessionContext';
import { ApiRequestError, confirmInstitutionalDeparture, confirmInstitutionalReturn, confirmManualMovement, confirmNfcMovement, confirmPermanentProviderMovement, confirmPrivateVehicleMovement, confirmVisitorBadgeReturn, createVehicleExceptionAuthorization, getActiveVisitorVisits, getAvailableVisitorBadges, getEmergencyPresence, getPendingVisitorBadgeReturns, getPresenceCount, lookupVisitorIdentity, registerVisitorEntry, registerVisitorEntryWithoutBadge, registerVisitorExit, resolveInstitutionalDeparture, resolveInstitutionalReturn, resolveLegacyVisitorBadgeAlert, resolveManualMovement, resolveNfcMovement, resolvePermanentProviderMovement, resolvePrivateVehicleMovement, searchActiveEmployees, uploadMovementPhoto, type ActiveVisitorVisit, type Employee, type EmergencyPresenceRecord, type InstitutionalTrip, type InstitutionalTripAsset, type ManualMovementResolution, type NfcMovementResolution, type PermanentProviderMovementResolution, type PrivateVehicleMovementResolution } from '@/services/api';
import { readPhysicalNfcUid } from '@/services/nfc';
import { PlateOcrScanner } from '@/components/plate-ocr-scanner';
import { VisitorVehicleEntryScreen } from '@/components/visitor-vehicle-entry';
import { ConnectionBanner } from '@/components/connection-banner';
import { useOffline } from '@/offline/OfflineProvider';
import { applyOfflineEmployeeMovement, enqueueOperation, readCache, saveCache } from '@/offline/storage';

const processNames: Record<string, string> = {
  nfc: 'Escanear TAG NFC',
  vehiculo: 'Vehículo particular',
  visitante: 'Registrar visitante',
  emergencia: 'Lista de emergencia',
};

export default function RegistrationScreen() {
  const { tipo } = useLocalSearchParams<{ tipo: string }>();
  if (tipo === 'nfc') return <NfcMovementScreen />;
  if (tipo === 'peatonal') return <ManualEmployeeMovementScreen />;
  if (tipo === 'vehiculo') return <PrivateVehicleMovementScreen />;
  if (tipo === 'institucional') return <InstitutionalVehicleMovementScreen />;
  if (tipo === 'visitante') return <VisitorMovementScreen />;
  if (tipo === 'vehiculo-visitante') return <VisitorVehicleEntryScreen />;
  if (tipo === 'proveedor') return <PermanentProviderMovementScreen />;
  if (tipo === 'emergencia') return <EmergencyPresenceScreen />;
  const title = processNames[tipo] ?? 'Proceso SICAF';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Volver a la pantalla principal"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.brand}>SICAF · DRAT</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>S</Text>
        </View>
        <Text style={styles.eyebrow}>PROCESO SELECCIONADO</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>
          La navegación base está funcionando. Este proceso se implementará en el entregable que le corresponde.
        </Text>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Base móvil preparada</Text>
          <Text style={styles.noticeText}>
            Esta pantalla provisional permite validar el flujo de navegación sin adelantar las integraciones de NFC, OCR o datos reales.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function PermanentProviderMovementScreen(){
  const{session}=useSession();const[mode,setMode]=useState<'NFC'|'PLACA'>('NFC');const[plate,setPlate]=useState('');const[ocrOpen,setOcrOpen]=useState(false);const[ocrPhotoUri,setOcrPhotoUri]=useState('');const[resolution,setResolution]=useState<PermanentProviderMovementResolution|null>(null);const[loading,setLoading]=useState(false);const[error,setError]=useState('');const[message,setMessage]=useState('');
  if(!session)return <Redirect href={'/login' as Href}/>;
  async function identifyByNfc(){setLoading(true);setError('');setMessage('');try{const code=await readPhysicalNfcUid();setResolution(await resolvePermanentProviderMovement(session!.token,{code}));}catch(reason){setError(reason instanceof Error?reason.message:'No fue posible identificar el proveedor');}finally{setLoading(false);}}
  async function identifyByPlate(){setLoading(true);setError('');setMessage('');try{setResolution(await resolvePermanentProviderMovement(session!.token,{plate}));}catch(reason){setError(reason instanceof Error?reason.message:'No fue posible identificar la placa');}finally{setLoading(false);}}
  async function confirm(){if(!resolution)return;setLoading(true);setError('');try{const movement=await confirmPermanentProviderMovement(session!.token,{code:resolution.provider.tagCode??undefined,plate:resolution.provider.tagCode?undefined:resolution.provider.plate??plate,movementType:resolution.proposedMovement});let evidence='';if(ocrPhotoUri&&resolution.provider.plate){try{await uploadMovementPhoto(session!.token,ocrPhotoUri,{movementType:'PROVEEDOR_PERMANENTE',movementId:movement.id,plate:resolution.provider.plate});evidence=' Fotografía almacenada.';}catch(reason){evidence=` ${reason instanceof Error?reason.message:'La evidencia fotográfica quedó pendiente.'}`;}}setMessage(`${resolution.proposedMovement==='INGRESO'?'Ingreso':'Salida'} del proveedor registrado correctamente.${evidence}`);setResolution(null);setPlate('');setOcrPhotoUri('');}catch(reason){setError(reason instanceof Error?reason.message:'No fue posible registrar el movimiento');}finally{setLoading(false);}}
  return <SafeAreaView style={styles.screen}><View style={styles.header}><Pressable onPress={()=>router.back()} style={styles.backButton}><Text style={styles.backText}>‹ Volver</Text></Pressable><Text style={styles.brand}>SICAF · DRAT</Text></View><ScrollView contentContainerStyle={styles.content}><Text style={styles.eyebrow}>CONTROL DE PROVEEDORES</Text><Text style={styles.title}>Proveedor permanente</Text><Text style={styles.description}>Identifique al proveedor mediante su TAG NFC o una placa activa asociada.</Text>
    {!resolution&&<><View style={styles.modeRow}><Pressable onPress={()=>setMode('NFC')} style={[styles.modeButton,mode==='NFC'&&styles.modeActive]}><Text style={mode==='NFC'?styles.modeActiveText:styles.cancelText}>TAG NFC</Text></Pressable><Pressable onPress={()=>setMode('PLACA')} style={[styles.modeButton,mode==='PLACA'&&styles.modeActive]}><Text style={mode==='PLACA'?styles.modeActiveText:styles.cancelText}>Placa</Text></Pressable></View>{mode==='NFC'?<Pressable disabled={loading} onPress={()=>void identifyByNfc()} style={styles.primaryButton}>{loading?<ActivityIndicator color="#fff"/>:<Text style={styles.primaryButtonText}>Leer TAG del proveedor</Text>}</Pressable>:<><Pressable disabled={loading} onPress={()=>setOcrOpen(true)} style={styles.nfcMethodButton}><View style={styles.nfcMethodIcon}><Text style={styles.nfcMethodIconText}>OCR</Text></View><View style={styles.nfcMethodText}><Text style={styles.nfcMethodTitle}>Fotografiar placa</Text><Text style={styles.employeeDetail}>Capture, revise y apruebe la lectura antes de buscar</Text></View><Text style={styles.methodArrow}>›</Text></Pressable><Text style={styles.fieldLabel}>Placa detectada o ingreso manual</Text><TextInput autoCapitalize="characters" value={plate} onChangeText={setPlate} placeholder="ABC123" placeholderTextColor={colors.muted} style={styles.input}/><Pressable disabled={loading||plate.trim().length<3} onPress={()=>void identifyByPlate()} style={[styles.primaryButton,(loading||plate.trim().length<3)&&{opacity:.45}]}>{loading?<ActivityIndicator color="#fff"/>:<Text style={styles.primaryButtonText}>Buscar proveedor</Text>}</Pressable></>}</>}
    {resolution&&<View style={styles.employeeResult}><Text style={styles.confirmLabel}>PROVEEDOR IDENTIFICADO</Text><Text style={styles.employeeResultName}>{resolution.provider.name}</Text><Text style={styles.employeeDetail}>{resolution.provider.identification} · {resolution.provider.company}</Text><Text style={styles.employeeDetail}>Contacto: {resolution.provider.phone}</Text><Text style={styles.employeeDetail}>{resolution.provider.plate?`Placa: ${resolution.provider.plate}`:`TAG: ${resolution.provider.tagCode}`}</Text><Text style={styles.confirmQuestion}>Movimiento propuesto: {resolution.proposedMovement}</Text><Pressable disabled={loading} onPress={()=>void confirm()} style={styles.primaryButton}>{loading?<ActivityIndicator color="#fff"/>:<Text style={styles.primaryButtonText}>Confirmar {resolution.proposedMovement.toLowerCase()}</Text>}</Pressable><Pressable onPress={()=>setResolution(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable></View>}
    {error?<Text style={styles.error}>{error}</Text>:null}{message?<Text style={styles.success}>{message}</Text>:null}<View style={styles.notice}><Text style={styles.noticeTitle}>Validaciones activas</Text><Text style={styles.noticeText}>Un proveedor inactivo, una placa no asociada o un TAG inválido no genera movimientos. Cada registro conserva fecha, hora y operador.</Text></View></ScrollView><Modal visible={ocrOpen} animationType="slide" onRequestClose={()=>setOcrOpen(false)}><SafeAreaView style={styles.screen}><PlateOcrScanner onCancel={()=>setOcrOpen(false)} onApprove={(approvedPlate,photoUri)=>{setPlate(approvedPlate);setOcrPhotoUri(photoUri);setOcrOpen(false);void resolvePermanentProviderMovement(session.token,{plate:approvedPlate}).then(setResolution).catch((reason:unknown)=>setError(reason instanceof Error?reason.message:'No fue posible identificar la placa'));}}/></SafeAreaView></Modal></SafeAreaView>;
}

function EmergencyPresenceScreen() {
  const { session } = useSession();
  const { isOnline } = useOffline();
  const [people, setPeople] = useState<EmergencyPresenceRecord[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [source, setSource] = useState<'SERVIDOR' | 'LOCAL'>('LOCAL');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  useEffect(() => {
    if (!session) return;
    const token = session.token;
    let active = true;
    async function loadCachedPresence(message = '') {
      const [cached, cachedAt] = await Promise.all([
        readCache<EmergencyPresenceRecord[]>('emergency-presence'),
        readCache<string>('emergency-presence-synced-at'),
      ]);
      if (!active) return;
      setSource('LOCAL'); setLastSyncedAt(cachedAt);
      if (cached !== null) { setPeople(cached); setHasSnapshot(true); setError(message); }
      else { setHasSnapshot(false); setError('No hay una lista local disponible. Conéctese una vez para sincronizarla.'); }
    }
    async function loadPresence() {
      setLoading(true); setError('');
      if (!isOnline) { await loadCachedPresence(); setLoading(false); return; }
      try {
        const data = await getEmergencyPresence(token);
        const syncedAt = new Date().toISOString();
        await Promise.all([saveCache('emergency-presence', data), saveCache('emergency-presence-synced-at', syncedAt)]);
        if (!active) return;
        setPeople(data); setHasSnapshot(true); setSource('SERVIDOR'); setLastSyncedAt(syncedAt);
      } catch {
        await loadCachedPresence('No fue posible consultar el servidor. Se muestra la última lista guardada.');
      } finally { if (active) setLoading(false); }
    }
    void loadPresence();
    return () => { active = false; };
  }, [session, isOnline]);
  if (!session) return <Redirect href={'/login' as Href} />;
  return <SafeAreaView style={styles.screen}><ConnectionBanner/><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹ Volver</Text></Pressable><Text style={styles.brand}>SICAF · DRAT</Text></View><ScrollView contentContainerStyle={styles.nfcContent}>
    <Text style={styles.eyebrow}>CONTROL DE AFORO</Text><Text style={styles.title}>Lista de emergencia</Text><Text style={styles.description}>{people.length} {people.length === 1 ? 'persona dentro' : 'personas dentro'}. Incluye funcionarios y visitantes con ingreso vigente.</Text>
    <View style={styles.emergencySnapshot}><Text style={styles.emergencySnapshotTitle}>{source === 'LOCAL' ? 'INFORMACIÓN LOCAL DISPONIBLE' : 'INFORMACIÓN SINCRONIZADA'}</Text><Text style={styles.emergencySnapshotText}>Fuente: {source === 'LOCAL' ? 'memoria de este dispositivo' : 'servidor SICAF'}</Text><Text style={styles.emergencySnapshotText}>Última sincronización: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('es-CR') : 'Aún no disponible'}</Text></View>
    {loading ? <ActivityIndicator color={colors.primary}/> : !hasSnapshot ? null : people.length === 0 ? <View style={styles.notice}><Text style={styles.noticeTitle}>Plantel sin personas registradas</Text><Text style={styles.noticeText}>Actualmente no existe ningún funcionario ni visitante con estado de ingreso.</Text></View> : people.map((person) => <View key={`${person.kind}-${person.id}`} style={styles.employeeResult}><Text style={styles.confirmLabel}>{person.kind}</Text><Text style={styles.employeeResultName}>{person.name}</Text><Text style={styles.employeeDetail}>{person.identification}</Text><Text style={styles.employeeDetail}>{person.detail}</Text><Text style={styles.employeeDetail}>Ingreso: {new Date(person.enteredAt).toLocaleString('es-CR')}</Text></View>)}
    {!isOnline ? <View style={styles.notice}><Text style={styles.noticeTitle}>Consulta local</Text><Text style={styles.noticeText}>Esta lista corresponde a la última sincronización y permanece disponible aunque cierre la aplicación.</Text></View> : null}{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </ScrollView></SafeAreaView>;
}

function VisitorMovementScreen() {
  const { session } = useSession();
  const [identification, setIdentification] = useState(''); const [name, setName] = useState('');
  const [reason, setReason] = useState(''); const [badgeCode, setBadgeCode] = useState('');
  const [activeVisits, setActiveVisits] = useState<ActiveVisitorVisit[]>([]);
  const [pendingReturns, setPendingReturns] = useState<ActiveVisitorVisit[]>([]);
  const [availableBadges, setAvailableBadges] = useState<string[]>([]); const [identityChecked, setIdentityChecked] = useState(false);
  const [visitorStateLoaded, setVisitorStateLoaded] = useState(false);
  const [contingencyObservation,setContingencyObservation]=useState('');const[contingencyConfirmed,setContingencyConfirmed]=useState(false);
  const [loading, setLoading] = useState(false); const [processingVisitId, setProcessingVisitId] = useState<string | null>(null); const [scanningBadge, setScanningBadge] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  useEffect(() => { if (!session) return; Promise.all([getActiveVisitorVisits(session.token), getAvailableVisitorBadges(session.token), getPendingVisitorBadgeReturns(session.token)]).then(([visits, badges, pending]) => { setActiveVisits(visits); setAvailableBadges(badges); setPendingReturns(pending); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar visitantes y gafetes')).finally(() => setVisitorStateLoaded(true)); }, [session]);
  if (!session) return <Redirect href={'/login' as Href} />;
  async function loadVisitorState() { const [visits, badges, pending] = await Promise.all([getActiveVisitorVisits(session!.token), getAvailableVisitorBadges(session!.token), getPendingVisitorBadgeReturns(session!.token)]); setActiveVisits(visits); setAvailableBadges(badges); setPendingReturns(pending); setVisitorStateLoaded(true); }
  async function loadActive() { setLoading(true); setError(''); try { await loadVisitorState(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible cargar las visitas activas'); } finally { setLoading(false); } }
  async function checkIdentity() { setLoading(true); setError(''); setSuccess(''); try { const visitor = await lookupVisitorIdentity(session!.token, identification); setIdentityChecked(true); if (visitor) { setIdentification(visitor.identification); setName(visitor.name); setSuccess('Identidad encontrada. Verifique el nombre antes de continuar.'); } else { setName(''); setSuccess('No existe una visita previa. Complete el nombre manualmente con autorización.'); } } catch (cause) { setIdentityChecked(false); setError(cause instanceof Error ? cause.message : 'No fue posible consultar la identidad'); } finally { setLoading(false); } }
  async function enter() { setLoading(true); setError(''); setSuccess(''); try { if (!identityChecked) throw new Error('Consulte primero la identificación o habilite el ingreso manual.'); if (!availableBadges.includes(badgeCode)) throw new Error('Seleccione uno de los gafetes disponibles.'); const visit = await registerVisitorEntry(session!.token, { identification, name, reason, badgeCode }); setSuccess(`Ingreso registrado para ${visit.name}. Gafete ${visit.badgeCode}.`); setIdentification(''); setName(''); setReason(''); setBadgeCode(''); setIdentityChecked(false); await loadVisitorState(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible registrar la visita'); } finally { setLoading(false); } }
  async function enterWithoutBadge(){setLoading(true);setError('');setSuccess('');try{if(!identityChecked)throw new Error('Consulte primero la identificación o habilite el ingreso manual.');const visit=await registerVisitorEntryWithoutBadge(session!.token,{identification,name,reason,observation:contingencyObservation,confirmed:contingencyConfirmed});setSuccess(`Ingreso sin gafete registrado para ${visit.name}; pendiente de revisión administrativa.`);setIdentification('');setName('');setReason('');setContingencyObservation('');setContingencyConfirmed(false);setIdentityChecked(false);await loadVisitorState();}catch(cause){setError(cause instanceof Error?cause.message:'No fue posible registrar la contingencia');}finally{setLoading(false);}}
  async function exit(visit: ActiveVisitorVisit, returned: boolean) { setLoading(true); setProcessingVisitId(visit.id); setError(''); try { const code = returned ? await readPhysicalNfcUid() : undefined; const result = await registerVisitorExit(session!.token, visit.id, code); setSuccess(result.badgeReturnPending ? `Salida registrada para ${visit.name}; devolución del gafete pendiente.` : `Salida y devolución registradas para ${visit.name}.`); await loadVisitorState(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible registrar la salida'); } finally { setLoading(false); setProcessingVisitId(null); } }
  async function returnPending(visit: ActiveVisitorVisit) { setLoading(true); setError(''); try { const code = await readPhysicalNfcUid(); await confirmVisitorBadgeReturn(session!.token, visit.id, code); setSuccess(`Devolución del gafete ${visit.badgeCode} registrada.`); await loadVisitorState(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible registrar la devolución'); } finally { setLoading(false); } }
  async function resolveLegacy(visit: ActiveVisitorVisit) { setLoading(true); setError(''); try { await resolveLegacyVisitorBadgeAlert(session!.token, visit.id); setSuccess(`Alerta ficticia ${visit.badgeCode} resuelta administrativamente.`); await loadVisitorState(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible resolver la alerta'); } finally { setLoading(false); } }
  async function scanAvailableBadge() { setScanningBadge(true); setError(''); try { const code = await readPhysicalNfcUid(); if (!availableBadges.includes(code)) throw new Error('Este TAG todavía no está registrado como gafete disponible para visitantes.'); setBadgeCode(code); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible leer el TAG'); } finally { setScanningBadge(false); } }
  function confirmExitWithoutBadge(visit: ActiveVisitorVisit) { Alert.alert('Salida sin devolución', `${visit.name} saldrá sin devolver el gafete ${visit.badgeCode}. Esto generará una alerta pendiente.`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar sin devolución', style: 'destructive', onPress: () => void exit(visit, false) }]); }
  return <SafeAreaView style={styles.screen}><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹ Volver</Text></Pressable><Text style={styles.brand}>SICAF · DRAT</Text></View><ScrollView contentContainerStyle={styles.nfcContent} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>CONTROL DE VISITAS</Text><Text style={styles.title}>Registrar visitante</Text><Text style={styles.description}>Registre a toda persona externa antes de permitirle ingresar o retirar un vehículo.</Text>
    <Text style={styles.fieldLabel}>Identificación</Text><TextInput value={identification} onChangeText={(value) => { setIdentification(value); setIdentityChecked(false); }} autoCapitalize="characters" style={styles.input}/><Pressable disabled={loading || identification.trim().length < 2} onPress={() => void checkIdentity()} style={styles.cancelButton}><Text style={styles.cancelText}>Consultar identificación</Text></Pressable><Pressable onPress={() => { setIdentityChecked(true); setName(''); setSuccess('Ingreso manual autorizado. Complete y verifique los datos.'); }} style={styles.cancelButton}><Text style={styles.cancelText}>Continuar con ingreso manual</Text></Pressable>
    <Text style={styles.fieldLabel}>Nombre completo</Text><TextInput editable={identityChecked} value={name} onChangeText={setName} style={styles.input}/>
    <Text style={styles.fieldLabel}>Motivo de visita</Text><TextInput value={reason} onChangeText={setReason} style={styles.input}/>
    {!visitorStateLoaded ? <ActivityIndicator color={colors.primary}/> : null}
    {availableBadges.length>0?<><Text style={styles.fieldLabel}>Gafete NFC disponible</Text><Pressable disabled={scanningBadge} onPress={() => void scanAvailableBadge()} style={styles.cancelButton}>{scanningBadge ? <ActivityIndicator color={colors.primary}/> : <Text style={styles.cancelText}>Leer gafete NFC</Text>}</Pressable>{scanningBadge ? <Text style={styles.employeeDetail}>Lectura activa: acerque el gafete a la parte posterior del teléfono.</Text> : null}{badgeCode ? <Text style={styles.success}>TAG seleccionado: {badgeCode}</Text> : null}<Pressable disabled={loading || !identityChecked || identification.trim().length < 2 || !name.trim() || !reason.trim() || !badgeCode} onPress={() => void enter()} style={styles.primaryButton}>{loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.primaryButtonText}>Confirmar ingreso y asignar gafete</Text>}</Pressable></>:<View style={styles.confirmCard}><Text style={styles.confirmLabel}>NO EXISTEN GAFETES DISPONIBLES</Text><Text style={styles.description}>Solo puede continuar mediante una contingencia explícita. El caso quedará pendiente de revisión administrativa.</Text><Text style={styles.fieldLabel}>Observación obligatoria</Text><TextInput value={contingencyObservation} onChangeText={setContingencyObservation} placeholder="Explique por qué se permite el ingreso sin gafete" placeholderTextColor={colors.muted} style={styles.input}/><Pressable onPress={()=>setContingencyConfirmed((value)=>!value)} style={styles.cancelButton}><Text style={styles.cancelText}>{contingencyConfirmed?'✓':'○'} Confirmo el ingreso excepcional sin gafete</Text></Pressable><Pressable disabled={loading||!identityChecked||identification.trim().length<2||!name.trim()||!reason.trim()||contingencyObservation.trim().length<10||!contingencyConfirmed} onPress={()=>void enterWithoutBadge()} style={[styles.primaryButton,(loading||!identityChecked||identification.trim().length<2||!name.trim()||!reason.trim()||contingencyObservation.trim().length<10||!contingencyConfirmed)&&{opacity:.45}]}>{loading?<ActivityIndicator color="#fff"/>:<Text style={styles.primaryButtonText}>Registrar contingencia e ingreso</Text>}</Pressable></View>}
    <Pressable disabled={loading} onPress={() => void loadActive()} style={styles.cancelButton}><Text style={styles.cancelText}>Actualizar visitantes y gafetes</Text></Pressable>
    {activeVisits.map((visit) => <View key={visit.id} style={styles.employeeResult}><Text style={styles.employeeResultName}>{visit.name}</Text><Text style={styles.employeeDetail}>{visit.identification} · {visit.badgeCode?`Gafete ${visit.badgeCode}`:'CONTINGENCIA SIN GAFETE'}</Text><Text style={styles.employeeDetail}>{visit.reason}</Text>{visit.badgeCode?<><Pressable disabled={loading} onPress={() => void exit(visit, true)} style={styles.returnBadgeButton}>{processingVisitId === visit.id ? <ActivityIndicator color="#fff"/> : <Text style={styles.returnBadgeText}>Leer gafete y registrar salida</Text>}</Pressable><Pressable disabled={loading} onPress={() => confirmExitWithoutBadge(visit)} style={styles.missingBadgeButton}><Text style={styles.missingBadgeText}>Registrar salida sin devolución</Text></Pressable></>:<Pressable disabled={loading} onPress={() => void exit(visit,false)} style={styles.returnBadgeButton}><Text style={styles.returnBadgeText}>Registrar salida de contingencia</Text></Pressable>}</View>)}
    {pendingReturns.length > 0 ? <><Text style={styles.fieldLabel}>Alertas de devolución pendientes</Text>{pendingReturns.map((visit) => <View key={visit.id} style={styles.employeeResult}><Text style={styles.employeeResultName}>{visit.name}</Text><Text style={styles.employeeDetail}>Debe devolver {visit.badgeCode}</Text><Pressable onPress={() => void returnPending(visit)}><Text style={styles.removeText}>Leer TAG devuelto</Text></Pressable>{session.user.role === 'ADMINISTRADOR' ? <Pressable onPress={() => void resolveLegacy(visit)}><Text style={styles.selectText}>Resolver solo si es un registro ficticio legado</Text></Pressable> : null}</View>)}</> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{success ? <Text style={styles.success}>{success}</Text> : null}
  </ScrollView></SafeAreaView>;
}

function InstitutionalVehicleMovementScreen() {
  const { session } = useSession();
  const [mode, setMode] = useState<'SALIDA' | 'INGRESO'>('SALIDA');
  const [plate, setPlate] = useState(''); const [soin, setSoin] = useState('');
  const [mileage, setMileage] = useState(''); const [fuel, setFuel] = useState(''); const [destination, setDestination] = useState('');
  const [vehicle, setVehicle] = useState<{ plate: string; brand: string; model: string; assetCode: string } | null>(null);
  const [trip, setTrip] = useState<InstitutionalTrip | null>(null); const [driver, setDriver] = useState<Employee | null>(null); const [tripOccupants, setTripOccupants] = useState<Employee[]>([]);
  const [assets, setAssets] = useState<InstitutionalTripAsset[]>([]); const [assetDescription, setAssetDescription] = useState(''); const [assetQuantity, setAssetQuantity] = useState('1'); const [assetIdentifier, setAssetIdentifier] = useState(''); const [assetObservation, setAssetObservation] = useState('');
  const [assetReturns, setAssetReturns] = useState<Record<string, { quantity: string; observation: string }>>({});
  const [search, setSearch] = useState(''); const [results, setResults] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrPhotoUri, setOcrPhotoUri] = useState('');
  if (!session) return <Redirect href={'/login' as Href} />;
  const reset = (next: 'SALIDA' | 'INGRESO') => { setMode(next); setVehicle(null); setTrip(null); setDriver(null); setTripOccupants([]); setAssets([]); setAssetReturns({}); setResults([]); setError(''); setSuccess(''); setMileage(''); setFuel(''); };
  async function resolve(approvedPlate?: string) { setLoading(true); setError(''); setSuccess(''); try { if (mode === 'SALIDA') { const plateToResolve = approvedPlate ?? plate; setPlate(plateToResolve); setVehicle((await resolveInstitutionalDeparture(session!.token, plateToResolve)).vehicle); } else { const found = await resolveInstitutionalReturn(session!.token, soin); setTrip(found); setSoin(found.soinNumber); setAssetReturns(Object.fromEntries(found.assets.filter((asset) => asset.id).map((asset) => [asset.id!, { quantity: String(asset.quantity), observation: '' }]))); } } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible consultar el viaje'); } finally { setLoading(false); } }
  async function findDriver() { setLoading(true); setError(''); try { setResults(await searchActiveEmployees(session!.token, search)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible buscar funcionarios'); } finally { setLoading(false); } }
  function addAsset() { const quantity = Number(assetQuantity); if (assetDescription.trim().length < 2) { setError('Ingrese la descripción del activo.'); return; } if (!Number.isInteger(quantity) || quantity < 1) { setError('La cantidad del activo debe ser un número mayor que cero.'); return; } setAssets((current) => [...current, { description: assetDescription.trim(), quantity, identifier: assetIdentifier.trim() || undefined, observation: assetObservation.trim() || undefined }]); setAssetDescription(''); setAssetQuantity('1'); setAssetIdentifier(''); setAssetObservation(''); setError(''); }
  async function confirm() { setLoading(true); setError(''); try { if (mode === 'SALIDA') { if (!vehicle || !driver) throw new Error('Seleccione el vehículo y el chofer.'); const movement=await confirmInstitutionalDeparture(session!.token, { plate: vehicle.plate, soinNumber: soin, mileage: Number(mileage), fuel: Number(fuel), destination, driverEmployeeId: driver.id, occupantEmployeeIds: tripOccupants.map((item) => item.id), assets }); let evidence='';if(ocrPhotoUri){try{await uploadMovementPhoto(session!.token,ocrPhotoUri,{movementType:'VEHICULO_INSTITUCIONAL',movementId:movement.id,plate:vehicle.plate});evidence=' Fotografía almacenada.';}catch(reason){evidence=` ${reason instanceof Error?reason.message:'La evidencia fotográfica quedó pendiente.'}`;}}setSuccess(`Salida institucional registrada correctamente.${evidence}`); } else { if (!trip) throw new Error('Consulte primero la boleta SOIN.'); const verifiedAssets = trip.assets.map((asset) => { const value = asset.id ? assetReturns[asset.id] : undefined; const returnedQuantity = Number(value?.quantity); if (!asset.id || !Number.isInteger(returnedQuantity) || returnedQuantity < 0 || returnedQuantity > asset.quantity) throw new Error(`Cantidad devuelta inválida para ${asset.description}.`); if (returnedQuantity < asset.quantity && !value?.observation.trim()) throw new Error(`Agregue una observación para el faltante de ${asset.description}.`); return { id: asset.id, returnedQuantity, observation: value?.observation.trim() || undefined }; }); await confirmInstitutionalReturn(session!.token, { soinNumber: trip.soinNumber, mileage: Number(mileage), fuel: Number(fuel), assets: verifiedAssets }); setSuccess(verifiedAssets.some((item, index) => item.returnedQuantity < trip.assets[index].quantity) ? 'Ingreso registrado con faltantes pendientes de revisión.' : 'Ingreso institucional registrado correctamente.'); } setVehicle(null); setTrip(null); setDriver(null); setTripOccupants([]); setAssets([]); setAssetReturns({}); setMileage(''); setFuel('');setOcrPhotoUri(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible registrar el movimiento'); } finally { setLoading(false); } }
  const ready = mode === 'SALIDA' ? vehicle : trip;
  return <SafeAreaView style={styles.screen}><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹ Volver</Text></Pressable><Text style={styles.brand}>SICAF · DRAT</Text></View><ScrollView contentContainerStyle={styles.nfcContent} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>CONTROL DE FLOTILLA</Text><Text style={styles.title}>Vehículo institucional</Text><Text style={styles.description}>Identifique la placa por cámara o escritura manual. La boleta SOIN conserva los datos del viaje y relaciona automáticamente la salida con su ingreso.</Text>
    <View style={styles.modeRow}><Pressable onPress={() => reset('SALIDA')} style={[styles.modeButton, mode === 'SALIDA' && styles.modeActive]}><Text style={mode === 'SALIDA' ? styles.modeActiveText : styles.cancelText}>Registrar salida</Text></Pressable><Pressable onPress={() => reset('INGRESO')} style={[styles.modeButton, mode === 'INGRESO' && styles.modeActive]}><Text style={mode === 'INGRESO' ? styles.modeActiveText : styles.cancelText}>Registrar ingreso</Text></Pressable></View>
    {!ready && <>{mode === 'SALIDA' && <><Pressable disabled={loading} onPress={() => setOcrOpen(true)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Escanear placa con cámara</Text></Pressable><View style={styles.methodDivider}><View style={styles.dividerLine}/><Text style={styles.dividerText}>O INGRESO MANUAL</Text><View style={styles.dividerLine}/></View></>}<Text style={styles.fieldLabel}>{mode === 'SALIDA' ? 'Placa institucional' : 'Número de boleta SOIN'}</Text><TextInput autoCapitalize="characters" value={mode === 'SALIDA' ? plate : soin} onChangeText={mode === 'SALIDA' ? setPlate : setSoin} placeholder={mode === 'SALIDA' ? 'Ejemplo: SM1234' : 'Ejemplo: SOIN-2026-001'} placeholderTextColor={colors.muted} style={styles.input}/><Pressable disabled={loading} onPress={() => void resolve()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Consultar</Text></Pressable></>}
    {ready && <View style={styles.confirmCard}><Text style={styles.confirmLabel}>{mode === 'SALIDA' ? 'VEHÍCULO IDENTIFICADO' : 'VIAJE SOIN IDENTIFICADO'}</Text><Text style={styles.employeeName}>{mode === 'SALIDA' ? vehicle?.plate : trip?.vehicle.plate}</Text><Text style={styles.employeeDetail}>{mode === 'SALIDA' ? `${vehicle?.brand} ${vehicle?.model} · Activo ${vehicle?.assetCode}` : `${trip?.vehicle.brand} ${trip?.vehicle.model} · ${trip?.destination}`}</Text>
      {mode === 'INGRESO' && trip && <><Text style={styles.fieldLabel}>Datos asociados</Text><Text style={styles.employeeResultName}>Chofer: {trip.driver.name}</Text><Text style={styles.employeeDetail}>Salida: {trip.departureMileage} km · {trip.departureFuel}% combustible · {trip.occupants.length} acompañantes</Text></>}
      {mode === 'SALIDA' && !driver && <><Text style={styles.fieldLabel}>Buscar chofer</Text><TextInput value={search} onChangeText={setSearch} placeholder="Nombre o identificación" placeholderTextColor={colors.muted} style={styles.input}/><Pressable onPress={() => void findDriver()} style={styles.cancelButton}><Text style={styles.cancelText}>Buscar chofer</Text></Pressable>{results.map((item) => <Pressable key={item.id} onPress={() => { setDriver(item); setResults([]); setSearch(''); }} style={styles.employeeResult}><Text style={styles.employeeResultName}>{item.name}</Text><Text style={styles.employeeDetail}>{item.identification} · {item.department}</Text></Pressable>)}</>}
      {mode === 'SALIDA' && driver && <><Text style={styles.fieldLabel}>Chofer</Text><Text style={styles.employeeResultName}>{driver.name}</Text><Pressable onPress={() => setDriver(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cambiar chofer</Text></Pressable><Text style={styles.fieldLabel}>Acompañantes ({tripOccupants.length})</Text>{tripOccupants.map((item) => <View key={item.id} style={styles.occupantRow}><Text style={styles.employeeResultName}>{item.name}</Text><Pressable onPress={() => setTripOccupants((current) => current.filter((person) => person.id !== item.id))}><Text style={styles.removeText}>Quitar</Text></Pressable></View>)}<TextInput value={search} onChangeText={setSearch} placeholder="Nombre o identificación del acompañante" placeholderTextColor={colors.muted} style={styles.input}/><Pressable onPress={() => void findDriver()} style={styles.cancelButton}><Text style={styles.cancelText}>Buscar acompañante</Text></Pressable>{results.map((item) => <Pressable key={item.id} onPress={() => { if (item.id === driver.id || tripOccupants.some((person) => person.id === item.id)) setError('El funcionario ya forma parte del viaje.'); else setTripOccupants((current) => [...current, item]); setResults([]); setSearch(''); }} style={styles.employeeResult}><Text style={styles.employeeResultName}>{item.name}</Text><Text style={styles.employeeDetail}>{item.identification} · {item.department}</Text></Pressable>)}<Text style={styles.fieldLabel}>Boleta SOIN</Text><TextInput autoCapitalize="characters" value={soin} onChangeText={setSoin} style={styles.input}/><Text style={styles.fieldLabel}>Destino</Text><TextInput value={destination} onChangeText={setDestination} style={styles.input}/></>}
      {mode === 'SALIDA' && driver && <><Text style={styles.fieldLabel}>Activos que salen ({assets.length})</Text>{assets.map((asset, index) => <View key={`${asset.description}-${index}`} style={styles.employeeResult}><Text style={styles.employeeResultName}>{asset.quantity} × {asset.description}</Text><Text style={styles.employeeDetail}>{asset.identifier ? `Identificador: ${asset.identifier}` : 'Sin identificador'}{asset.observation ? ` · ${asset.observation}` : ''}</Text><Pressable onPress={() => setAssets((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Text style={styles.removeText}>Quitar activo</Text></Pressable></View>)}<TextInput value={assetDescription} onChangeText={setAssetDescription} placeholder="Descripción del activo" placeholderTextColor={colors.muted} style={styles.input}/><TextInput keyboardType="numeric" value={assetQuantity} onChangeText={setAssetQuantity} placeholder="Cantidad" placeholderTextColor={colors.muted} style={styles.input}/><TextInput value={assetIdentifier} onChangeText={setAssetIdentifier} placeholder="Identificador, placa o número de activo (opcional)" placeholderTextColor={colors.muted} style={styles.input}/><TextInput value={assetObservation} onChangeText={setAssetObservation} placeholder="Observación (opcional)" placeholderTextColor={colors.muted} style={styles.input}/><Pressable onPress={addAsset} style={styles.cancelButton}><Text style={styles.cancelText}>Agregar activo a la boleta</Text></Pressable></>}
      {mode === 'INGRESO' && trip && <><Text style={styles.fieldLabel}>Verificar activos de la boleta ({trip.assets.length})</Text>{trip.assets.length === 0 ? <Text style={styles.employeeDetail}>Esta boleta no registra activos.</Text> : trip.assets.map((asset, index) => { const key = asset.id ?? `${asset.description}-${index}`; const returned = asset.id ? assetReturns[asset.id] : undefined; return <View key={key} style={styles.employeeResult}><Text style={styles.employeeResultName}>{asset.quantity} × {asset.description}</Text><Text style={styles.employeeDetail}>{asset.identifier ? `Identificador: ${asset.identifier}` : 'Sin identificador'}{asset.observation ? ` · Salida: ${asset.observation}` : ''}</Text><Text style={styles.fieldLabel}>Cantidad que regresó</Text><TextInput keyboardType="numeric" value={returned?.quantity ?? ''} onChangeText={(quantity) => asset.id && setAssetReturns((current) => ({ ...current, [asset.id!]: { quantity, observation: current[asset.id!]?.observation ?? '' } }))} style={styles.input}/><TextInput value={returned?.observation ?? ''} onChangeText={(observation) => asset.id && setAssetReturns((current) => ({ ...current, [asset.id!]: { quantity: current[asset.id!]?.quantity ?? String(asset.quantity), observation } }))} placeholder={Number(returned?.quantity) < asset.quantity ? 'Observación obligatoria por faltante' : 'Observación de retorno (opcional)'} placeholderTextColor={colors.muted} style={styles.input}/></View>; })}</>}
      {(mode === 'INGRESO' || driver) && <><Text style={styles.fieldLabel}>Kilometraje de {mode === 'SALIDA' ? 'salida' : 'ingreso'}</Text><TextInput keyboardType="numeric" value={mileage} onChangeText={setMileage} style={styles.input}/><Text style={styles.fieldLabel}>Combustible (0–100%)</Text><TextInput keyboardType="numeric" value={fuel} onChangeText={setFuel} style={styles.input}/><Pressable disabled={loading} onPress={() => void confirm()} style={styles.primaryButton}>{loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.primaryButtonText}>Confirmar {mode.toLowerCase()}</Text>}</Pressable></>}
    </View>}{error ? <Text style={styles.error}>{error}</Text> : null}{success ? <Text style={styles.success}>{success}</Text> : null}
  </ScrollView><Modal visible={ocrOpen} animationType="slide" onRequestClose={() => setOcrOpen(false)}><SafeAreaView style={styles.screen}><PlateOcrScanner onCancel={() => setOcrOpen(false)} onApprove={(approvedPlate,photoUri) => { setPlate(approvedPlate);setOcrPhotoUri(photoUri); setOcrOpen(false); void resolve(approvedPlate); }}/></SafeAreaView></Modal></SafeAreaView>;
}

function PrivateVehicleMovementScreen() {
  const { session } = useSession();
  const [plate, setPlate] = useState('');
  const [resolution, setResolution] = useState<PrivateVehicleMovementResolution | null>(null);
  const [driver, setDriver] = useState<Employee | null>(null);
  const [visitorDriver, setVisitorDriver] = useState<ActiveVisitorVisit | null>(null);
  const [visitorResults, setVisitorResults] = useState<ActiveVisitorVisit[]>([]);
  const [authorizationConfirmed, setAuthorizationConfirmed] = useState(false);
  const [authorizationNote, setAuthorizationNote] = useState('');
  const [occupants, setOccupants] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Employee[]>([]);
  const [selectionMode, setSelectionMode] = useState<'DRIVER' | 'OCCUPANT'>('OCCUPANT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [unknownPlate, setUnknownPlate] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrPhotoUri, setOcrPhotoUri] = useState('');
  const [plateSource, setPlateSource] = useState<'PLACA_MANUAL' | 'OCR'>('PLACA_MANUAL');
  const [plateManualReason, setPlateManualReason] = useState('');
  const [exception, setException] = useState<{entityId:string;movementType:'INGRESO'|'SALIDA'}|null>(null);
  const [exceptionReason,setExceptionReason]=useState('');const[authorizedByReference,setAuthorizedByReference]=useState('');const[exceptionObservations,setExceptionObservations]=useState('');

  if (!session) return <Redirect href={'/login' as Href} />;

  async function findVehicle(approvedPlate = plate) {
    if (!approvedPlate.trim()) { setError('Ingrese la placa del vehículo.'); return; }
    setLoading(true); setError(''); setSuccess(''); setUnknownPlate(false); setException(null);
    try {
      const found = await resolvePrivateVehicleMovement(session!.token, approvedPlate);
      setResolution(found); setPlate(found.vehicle.plate); setDriver(found.habitualDriver); setVisitorDriver(null); setOccupants([]); setResults([]); setVisitorResults([]); setAuthorizationConfirmed(false); setAuthorizationNote('');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'No fue posible consultar la placa';
      setError(message); setUnknownPlate(message.toLowerCase().includes('desconocida'));
      if(reason instanceof ApiRequestError&&reason.details?.code==='VEHICLE_AUTHORIZATION_REQUIRED'&&reason.details.entityId&&reason.details.requestedMovement)setException({entityId:reason.details.entityId,movementType:reason.details.requestedMovement});
    } finally { setLoading(false); }
  }

  async function findPeople() {
    if (!search.trim()) { setError('Escriba el nombre o la identificación.'); return; }
    setLoading(true); setError('');
    try { setResults(await searchActiveEmployees(session!.token, search)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible buscar funcionarios'); }
    finally { setLoading(false); }
  }

  async function findVisitors() {
    setLoading(true); setError('');
    try { setVisitorResults(await getActiveVisitorVisits(session!.token, search)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible buscar visitantes activos'); }
    finally { setLoading(false); }
  }

  function selectPerson(employee: Employee) {
    if (selectionMode === 'DRIVER') {
      setDriver(employee); setVisitorDriver(null); setOccupants((current) => current.filter((item) => item.id !== employee.id));
      setSelectionMode('OCCUPANT');
    } else if (employee.id === driver?.id) setError('El conductor no puede agregarse como acompañante.');
    else if (occupants.some((item) => item.id === employee.id)) setError('El funcionario ya está agregado como acompañante.');
    else setOccupants((current) => [...current, employee]);
    setResults([]); setSearch('');
  }

  async function scanOccupant() {
    setLoading(true); setError('');
    try {
      const uid = await readPhysicalNfcUid();
      const found = await resolveNfcMovement(session!.token, uid);
      if (found.employee.id === driver?.id) setError('El conductor no puede agregarse como acompañante.');
      else if (occupants.some((item) => item.id === found.employee.id)) setError('El funcionario ya está agregado como acompañante.');
      else setOccupants((current) => [...current, found.employee]);
      setSelectionMode('OCCUPANT');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible leer el TAG del acompañante'); }
    finally { setLoading(false); }
  }

  async function confirm() {
    if (!resolution || (!driver && !visitorDriver)) return;
    setLoading(true); setError('');
    try {
      const movement=await confirmPrivateVehicleMovement(session!.token, { plate: resolution.vehicle.plate, driverEmployeeId: driver?.id, driverVisitorVisitId: visitorDriver?.id, ownerAuthorizationConfirmed: visitorDriver ? authorizationConfirmed : undefined, authorizationNote: visitorDriver ? authorizationNote : undefined, occupantEmployeeIds: occupants.map((item) => item.id), movementType: resolution.proposedMovement, source: plateSource, manualReason: plateSource === 'PLACA_MANUAL' ? plateManualReason : undefined });
      let evidence='';if(ocrPhotoUri){try{await uploadMovementPhoto(session!.token,ocrPhotoUri,{movementType:'VEHICULO_PARTICULAR',movementId:movement.id,plate:resolution.vehicle.plate});evidence=' Fotografía almacenada.';}catch(reason){evidence=` ${reason instanceof Error?reason.message:'La evidencia fotográfica quedó pendiente.'}`;}}
      const count = await getPresenceCount(session!.token);
      setSuccess(`${resolution.proposedMovement === 'INGRESO' ? 'Ingreso' : 'Salida'} del vehículo registrado. Aforo actual: ${count}.${evidence}`);
      setResolution(null); setDriver(null); setVisitorDriver(null); setOccupants([]); setPlate(''); setPlateManualReason(''); setAuthorizationConfirmed(false); setAuthorizationNote('');setOcrPhotoUri('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible registrar el movimiento'); if(reason instanceof ApiRequestError&&reason.details?.code==='MOVEMENT_INCONSISTENCY'&&reason.details.entityId&&reason.details.requestedMovement)setException({entityId:reason.details.entityId,movementType:reason.details.requestedMovement}); }
    finally { setLoading(false); }
  }
  async function confirmException(){if(!exception)return;setLoading(true);setError('');try{await createVehicleExceptionAuthorization(session!.token,{entityId:exception.entityId,movementType:exception.movementType,reason:exceptionReason,authorizedByReference,observations:exceptionObservations});const count=await getPresenceCount(session!.token);setSuccess(`Ingreso excepcional autorizado y registrado. Aforo actual: ${count}.`);setException(null);setResolution(null);setPlate('');setExceptionReason('');setAuthorizedByReference('');setExceptionObservations('');}catch(reason){setError(reason instanceof Error?reason.message:'No fue posible registrar la autorización');}finally{setLoading(false);}}

  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹ Volver</Text></Pressable><Text style={styles.brand}>SICAF · DRAT</Text></View>
    <ScrollView contentContainerStyle={styles.nfcContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>MOVIMIENTO VEHICULAR</Text><Text style={styles.title}>Vehículo particular</Text><Text style={styles.description}>Ingrese la placa para identificar el vehículo y su conductor habitual. El reconocimiento por cámara se conectará posteriormente.</Text>
      {!resolution && <><Pressable disabled={loading} onPress={() => setOcrOpen(true)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Escanear placa con cámara</Text></Pressable><View style={styles.methodDivider}><View style={styles.dividerLine}/><Text style={styles.dividerText}>O INGRESO MANUAL</Text><View style={styles.dividerLine}/></View><Text style={styles.fieldLabel}>Placa</Text><TextInput autoCapitalize="characters" placeholder="Ejemplo: ABC123" placeholderTextColor={colors.muted} value={plate} onChangeText={(value) => { setPlate(value); setPlateSource('PLACA_MANUAL'); }} style={styles.input} onSubmitEditing={() => void findVehicle()} /><Pressable disabled={loading} onPress={() => void findVehicle()} style={styles.cancelButton}>{loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.cancelText}>Buscar placa escrita</Text>}</Pressable></>}
      {unknownPlate && <Pressable onPress={() => router.replace({ pathname: '/registro/[tipo]', params: { tipo: 'vehiculo-visitante' } })} style={styles.cancelButton}><Text style={styles.cancelText}>Registrar como vehículo visitante</Text></Pressable>}
      {resolution && <View style={styles.confirmCard}>
        <Text style={styles.confirmLabel}>VEHÍCULO IDENTIFICADO</Text><Text style={styles.employeeName}>{resolution.vehicle.plate}</Text><Text style={styles.employeeDetail}>{resolution.vehicle.brand} {resolution.vehicle.model} · {resolution.vehicle.color}</Text>
        <View style={[styles.movementBadge, resolution.proposedMovement === 'SALIDA' && styles.exitBadge]}><Text style={styles.movementText}>Movimiento propuesto: {resolution.proposedMovement}</Text></View>
        {(driver || visitorDriver) && <><Text style={styles.fieldLabel}>Persona que conduce o retira</Text><Text style={styles.employeeResultName}>{driver?.name ?? visitorDriver?.name}</Text><Text style={styles.employeeDetail}>{driver ? `${driver.identification} · ${driver.department}` : `${visitorDriver?.identification} · Visitante · Gafete ${visitorDriver?.badgeCode}`}</Text></>}
        <Pressable onPress={() => { setSelectionMode('DRIVER'); setResults([]); setSearch(''); }} style={styles.cancelButton}><Text style={styles.cancelText}>Cambiar conductor</Text></Pressable>
        {resolution.proposedMovement === 'SALIDA' && <Pressable onPress={() => { setDriver(null); setVisitorDriver(null); setVisitorResults([]); setResults([]); setSearch(''); }} style={styles.cancelButton}><Text style={styles.cancelText}>El vehículo será retirado por un visitante</Text></Pressable>}
        {!driver && !visitorDriver && resolution.proposedMovement === 'SALIDA' && <><Text style={styles.fieldLabel}>Buscar visitante activo</Text><TextInput placeholder="Nombre, identificación o gafete" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={styles.input}/><Pressable disabled={loading} onPress={() => void findVisitors()} style={styles.cancelButton}><Text style={styles.cancelText}>Buscar visitante</Text></Pressable>{visitorResults.map((visit) => <Pressable key={visit.id} onPress={() => { setVisitorDriver(visit); setVisitorResults([]); setSearch(''); }} style={styles.employeeResult}><Text style={styles.employeeResultName}>{visit.name}</Text><Text style={styles.employeeDetail}>{visit.identification} · Gafete {visit.badgeCode}</Text><Text style={styles.selectText}>Seleccionar ›</Text></Pressable>)}</>}
        {visitorDriver && <><Pressable onPress={() => setAuthorizationConfirmed((value) => !value)} style={styles.cancelButton}><Text style={styles.cancelText}>{authorizationConfirmed ? '✓ ' : '○ '}Confirmo autorización del propietario</Text></Pressable><Text style={styles.fieldLabel}>Observación de autorización</Text><TextInput placeholder="Ejemplo: propietario confirmó personalmente" placeholderTextColor={colors.muted} value={authorizationNote} onChangeText={setAuthorizationNote} style={styles.input}/></>}
        <Text style={styles.fieldLabel}>Acompañantes ({occupants.length})</Text>
        {occupants.map((item) => <View key={item.id} style={styles.occupantRow}><View><Text style={styles.employeeResultName}>{item.name}</Text><Text style={styles.employeeDetail}>{item.identification}</Text></View><Pressable onPress={() => setOccupants((current) => current.filter((person) => person.id !== item.id))}><Text style={styles.removeText}>Quitar</Text></Pressable></View>)}
        <Pressable disabled={loading} onPress={() => void scanOccupant()} style={styles.nfcMethodButton}><View style={styles.nfcMethodIcon}><Text style={styles.nfcMethodIconText}>NFC</Text></View><View style={styles.nfcMethodText}><Text style={styles.nfcMethodTitle}>Leer TAG de acompañante</Text><Text style={styles.employeeDetail}>Cada funcionario se identifica individualmente</Text></View></Pressable>
        <View style={styles.methodDivider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>O BÚSQUEDA MANUAL</Text><View style={styles.dividerLine} /></View>
        <TextInput placeholder="Nombre o identificación" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={styles.input} onFocus={() => { if (selectionMode !== 'DRIVER') setSelectionMode('OCCUPANT'); }} onSubmitEditing={() => void findPeople()} />
        <Pressable disabled={loading} onPress={() => void findPeople()} style={styles.cancelButton}><Text style={styles.cancelText}>Buscar {selectionMode === 'DRIVER' ? 'conductor' : 'acompañante'}</Text></Pressable>
        <View style={styles.employeeResults}>{results.map((employee) => <Pressable key={employee.id} onPress={() => selectPerson(employee)} style={styles.employeeResult}><Text style={styles.employeeResultName}>{employee.name}</Text><Text style={styles.employeeDetail}>{employee.identification} · {employee.department}</Text><Text style={styles.selectText}>Seleccionar ›</Text></Pressable>)}</View>
        {plateSource === 'PLACA_MANUAL' && <><Text style={styles.fieldLabel}>Motivo obligatorio del ingreso manual</Text><TextInput value={plateManualReason} onChangeText={setPlateManualReason} placeholder="Ejemplo: cámara OCR no disponible" placeholderTextColor={colors.muted} style={styles.input}/><Text style={styles.employeeDetail}>El movimiento quedará pendiente de revisión administrativa.</Text></>}<Text style={styles.confirmQuestion}>¿Confirma el movimiento del vehículo y sus ocupantes?</Text><Pressable disabled={loading || (!driver && !visitorDriver) || Boolean(exception) || (plateSource === 'PLACA_MANUAL' && plateManualReason.trim().length < 10)} onPress={() => void confirm()} style={[styles.primaryButton,(Boolean(exception) || (plateSource === 'PLACA_MANUAL' && plateManualReason.trim().length < 10))&&{opacity:.45}]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Confirmar {resolution.proposedMovement.toLowerCase()}</Text>}</Pressable><Pressable onPress={() => { setResolution(null); setDriver(null); setVisitorDriver(null); setOccupants([]); setResults([]); setException(null); setPlateManualReason(''); }} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar operación</Text></Pressable>
      </View>}
      {exception?<View style={styles.confirmCard}><Text style={styles.confirmLabel}>AUTORIZACIÓN EXCEPCIONAL REQUERIDA</Text><Text style={styles.description}>El flujo normal fue bloqueado. Registre únicamente una autorización que ya haya recibido de un responsable.</Text><Text style={styles.fieldLabel}>Motivo de la excepción</Text><TextInput value={exceptionReason} onChangeText={setExceptionReason} placeholder="Explique por qué se autoriza el ingreso" placeholderTextColor={colors.muted} style={styles.input}/><Text style={styles.fieldLabel}>Nombre o referencia de quien autoriza</Text><TextInput value={authorizedByReference} onChangeText={setAuthorizedByReference} placeholder="Nombre, cargo o referencia" placeholderTextColor={colors.muted} style={styles.input}/><Text style={styles.fieldLabel}>Observaciones</Text><TextInput value={exceptionObservations} onChangeText={setExceptionObservations} placeholder="Condiciones e indicaciones recibidas" placeholderTextColor={colors.muted} style={styles.input}/><Pressable disabled={loading||exceptionReason.trim().length<10||authorizedByReference.trim().length<2||exceptionObservations.trim().length<2} onPress={()=>void confirmException()} style={[styles.primaryButton,(loading||exceptionReason.trim().length<10||authorizedByReference.trim().length<2||exceptionObservations.trim().length<2)&&{opacity:.45}]}>{loading?<ActivityIndicator color="#fff"/>:<Text style={styles.primaryButtonText}>Registrar autorización y movimiento</Text>}</Pressable><Pressable onPress={()=>setException(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar autorización</Text></Pressable></View>:null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{success ? <Text style={styles.success}>{success}</Text> : null}
      <View style={styles.notice}><Text style={styles.noticeTitle}>Registro único</Text><Text style={styles.noticeText}>El conductor se registra una sola vez. Los acompañantes se agregan individualmente y una placa desconocida se envía al flujo de visitantes.</Text></View>
    </ScrollView>
    <Modal visible={ocrOpen} animationType="slide" onRequestClose={() => setOcrOpen(false)}><SafeAreaView style={styles.screen}><PlateOcrScanner onCancel={() => setOcrOpen(false)} onApprove={(approvedPlate,photoUri) => { setPlate(approvedPlate);setOcrPhotoUri(photoUri); setPlateSource('OCR'); setOcrOpen(false); void findVehicle(approvedPlate); }}/></SafeAreaView></Modal>
  </SafeAreaView>;
}

function ManualEmployeeMovementScreen() {
  const { session } = useSession();
  const { isOnline, refreshPending } = useOffline();
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [resolution, setResolution] = useState<ManualMovementResolution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [manualReason, setManualReason] = useState('');

  if (!session) return <Redirect href={'/login' as Href} />;

  async function findEmployees() {
    if (!session || !search.trim()) { setError('Escriba el nombre o la identificación.'); return; }
    setLoading(true); setError(''); setSuccess('');
    try { const found = await searchActiveEmployees(session.token, search); setEmployees(found); await saveCache(`employees:${search.trim().toLowerCase()}`, found); }
    catch (reason) { const cached = await readCache<Employee[]>(`employees:${search.trim().toLowerCase()}`); if (cached) { setEmployees(cached); setError('Sin conexión: resultados recuperados del almacenamiento local.'); } else setError(reason instanceof Error ? `${reason.message}. No existen resultados locales para esta búsqueda.` : 'No existen resultados locales para esta búsqueda.'); }
    finally { setLoading(false); }
  }

  async function selectEmployee(employee: Employee) {
    if (!session) return;
    setLoading(true); setError('');
    try { const result = await resolveManualMovement(session.token, employee.id); setResolution(result); await saveCache(`employee-resolution:${employee.id}`, result); setEmployees([]); }
    catch (reason) { const cached = await readCache<ManualMovementResolution>(`employee-resolution:${employee.id}`); if (cached) { setResolution(cached); setEmployees([]); setError('Sin conexión: se propondrá el movimiento según el último estado sincronizado.'); } else setError(reason instanceof Error ? `${reason.message}. Este funcionario no está preparado para uso sin conexión.` : 'Este funcionario no está preparado para uso sin conexión.'); }
    finally { setLoading(false); }
  }

  async function confirm() {
    if (!session || !resolution) return;
    setLoading(true); setError('');
    try {
      if (!isOnline) {
        await enqueueOperation('EMPLOYEE_MANUAL', { employeeId: resolution.employee.id, movementType: resolution.proposedMovement, reason: manualReason }, session.user);
        await applyOfflineEmployeeMovement(resolution.employee, resolution.proposedMovement, `employee-resolution:${resolution.employee.id}`, resolution);
        await refreshPending();
        setSuccess(`${resolution.proposedMovement === 'INGRESO' ? 'Ingreso' : 'Salida'} guardado localmente a las ${new Date().toLocaleTimeString('es-CR')}. Se sincronizará al recuperar internet.`);
        setResolution(null); setSearch(''); setManualReason(''); return;
      }
      await confirmManualMovement(session.token, resolution.employee.id, resolution.proposedMovement, manualReason);
      const count = await getPresenceCount(session.token);
      setSuccess(`${resolution.proposedMovement === 'INGRESO' ? 'Ingreso' : 'Salida'} registrado. Aforo actual: ${count} ${count === 1 ? 'persona' : 'personas'}.`);
      setResolution(null); setSearch(''); setManualReason('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible registrar el movimiento'); }
    finally { setLoading(false); }
  }

  return <SafeAreaView style={styles.screen}><ConnectionBanner/>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹ Volver</Text></Pressable><Text style={styles.brand}>SICAF · DRAT</Text></View>
    <ScrollView contentContainerStyle={styles.nfcContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>CONTROL DE AFORO</Text><Text style={styles.title}>Funcionario a pie</Text><Text style={styles.description}>Seleccione cómo desea identificar al funcionario: lectura de su TAG NFC o búsqueda manual autorizada.</Text>
      {!resolution && <Pressable onPress={() => router.replace({ pathname: '/registro/[tipo]', params: { tipo: 'nfc' } })} style={styles.nfcMethodButton}><View style={styles.nfcMethodIcon}><Text style={styles.nfcMethodIconText}>NFC</Text></View><View style={styles.nfcMethodText}><Text style={styles.nfcMethodTitle}>Identificar con TAG NFC</Text><Text style={styles.employeeDetail}>Método principal mediante gafete</Text></View><Text style={styles.methodArrow}>›</Text></Pressable>}
      {!resolution && <View style={styles.methodDivider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>O BUSCAR MANUALMENTE</Text><View style={styles.dividerLine} /></View>}
      {!resolution && <><Text style={styles.fieldLabel}>Buscar funcionario</Text><TextInput placeholder="Nombre o identificación" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={styles.input} onSubmitEditing={() => void findEmployees()} /><Pressable disabled={loading} onPress={() => void findEmployees()} style={styles.primaryButton}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Buscar</Text>}</Pressable>
      <View style={styles.employeeResults}>{employees.map((employee) => <Pressable key={employee.id} onPress={() => void selectEmployee(employee)} style={styles.employeeResult}><Text style={styles.employeeResultName}>{employee.name}</Text><Text style={styles.employeeDetail}>{employee.identification} · {employee.department}</Text><Text style={styles.selectText}>Seleccionar ›</Text></Pressable>)}</View></>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{success ? <Text style={styles.success}>{success}</Text> : null}
      {resolution && <View style={styles.confirmCard}><Text style={styles.confirmLabel}>FUNCIONARIO SELECCIONADO</Text><Text style={styles.employeeName}>{resolution.employee.name}</Text><Text style={styles.employeeDetail}>{resolution.employee.identification} · {resolution.employee.department}</Text><View style={[styles.movementBadge, resolution.proposedMovement === 'SALIDA' && styles.exitBadge]}><Text style={styles.movementText}>Movimiento propuesto: {resolution.proposedMovement}</Text></View><Text style={styles.fieldLabel}>Motivo obligatorio del uso manual</Text><TextInput value={manualReason} onChangeText={setManualReason} placeholder="Ejemplo: TAG NFC no disponible o dañado" placeholderTextColor={colors.muted} style={styles.input}/><Text style={styles.employeeDetail}>Este movimiento quedará pendiente de revisión administrativa.</Text><Text style={styles.confirmQuestion}>¿Confirma el movimiento peatonal?</Text><Pressable disabled={loading || manualReason.trim().length < 10} onPress={() => void confirm()} style={[styles.primaryButton, manualReason.trim().length < 10 && { opacity: .45 }]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Confirmar {resolution.proposedMovement.toLowerCase()}</Text>}</Pressable><Pressable onPress={() => { setResolution(null); setSearch(''); setManualReason(''); }} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar operación</Text></Pressable></View>}
      <View style={styles.notice}><Text style={styles.noticeTitle}>Registro autorizado</Text><Text style={styles.noticeText}>Solo se muestran funcionarios activos. El movimiento conserva persona, tipo, fecha, hora y usuario operador.</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

function NfcMovementScreen() {
  const { session } = useSession();
  const { isOnline, refreshPending } = useOffline();
  const [code, setCode] = useState('');
  const [resolution, setResolution] = useState<NfcMovementResolution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [source, setSource] = useState<'NFC_SIMULADO' | 'NFC_FISICO'>('NFC_FISICO');

  if (!session) return <Redirect href={'/login' as Href} />;

  async function resolveCode(value: string, nextSource: 'NFC_SIMULADO' | 'NFC_FISICO') {
    if (!session || !value.trim()) { setError('Ingrese el código de un TAG NFC.'); return; }
    setLoading(true); setError(''); setSuccess(''); setResolution(null);
    try { setSource(nextSource); setCode(value); const result = await resolveNfcMovement(session.token, value); setResolution(result); await saveCache(`nfc-resolution:${value.trim().toUpperCase()}`, result); }
    catch (reason) { const cached = await readCache<NfcMovementResolution>(`nfc-resolution:${value.trim().toUpperCase()}`); if (cached) { setSource(nextSource); setCode(value); setResolution(cached); setError('Sin conexión: TAG validado con la última información sincronizada.'); } else setError(reason instanceof Error ? `${reason.message}. Este TAG no está disponible localmente.` : 'Este TAG no está disponible localmente.'); }
    finally { setLoading(false); }
  }

  async function scan() {
    setLoading(true); setError(''); setSuccess(''); setResolution(null);
    try {
      const uid = await readPhysicalNfcUid();
      await resolveCode(uid, 'NFC_FISICO');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible leer la etiqueta NFC');
      setLoading(false);
    }
  }

  async function confirm() {
    if (!session || !resolution) return;
    setLoading(true); setError('');
    try {
      if (!isOnline) {
        await enqueueOperation('EMPLOYEE_NFC', { code: resolution.tag.code, movementType: resolution.proposedMovement, source }, session.user);
        await applyOfflineEmployeeMovement(resolution.employee, resolution.proposedMovement, `nfc-resolution:${resolution.tag.code.trim().toUpperCase()}`, resolution);
        await refreshPending();
        setSuccess(`${resolution.proposedMovement === 'INGRESO' ? 'Ingreso' : 'Salida'} guardado localmente para ${resolution.employee.name} a las ${new Date().toLocaleTimeString('es-CR')}.`);
        setResolution(null); setCode(''); return;
      }
      await confirmNfcMovement(session.token, resolution.tag.code, resolution.proposedMovement, source);
      setSuccess(`${resolution.proposedMovement === 'INGRESO' ? 'Ingreso' : 'Salida'} registrado correctamente para ${resolution.employee.name}.`);
      setResolution(null); setCode('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible registrar el movimiento'); }
    finally { setLoading(false); }
  }

  return <SafeAreaView style={styles.screen}><ConnectionBanner/>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹ Volver</Text></Pressable><Text style={styles.brand}>SICAF · DRAT</Text></View>
    <ScrollView contentContainerStyle={styles.nfcContent} keyboardShouldPersistTaps="handled">
      <View style={styles.testBadge}><Text style={styles.testBadgeText}>LECTURA NFC FÍSICA</Text></View>
      <Text style={styles.eyebrow}>MOVIMIENTO DE FUNCIONARIO</Text><Text style={styles.title}>Leer gafete NFC</Text>
      <Text style={styles.description}>Presione el botón y acerque el gafete al teléfono. El sistema identificará al funcionario y propondrá su ingreso o salida.</Text>
      {!resolution && <Pressable disabled={loading} onPress={() => void scan()} style={styles.primaryButton}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Iniciar lectura NFC</Text>}</Pressable>}
      {!resolution && <View style={styles.methodDivider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>CONTINGENCIA DE PRUEBA</Text><View style={styles.dividerLine} /></View>}
      {!resolution && <><Text style={styles.fieldLabel}>Código NFC manual</Text><TextInput autoCapitalize="characters" placeholder="Ejemplo: TAG-ANDRES-01" placeholderTextColor={colors.muted} value={code} onChangeText={setCode} style={styles.input} onSubmitEditing={() => void resolveCode(code, 'NFC_SIMULADO')} /><Pressable disabled={loading} onPress={() => void resolveCode(code, 'NFC_SIMULADO')} style={styles.cancelButton}><Text style={styles.cancelText}>Validar código manual</Text></Pressable></>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{success ? <Text style={styles.success}>{success}</Text> : null}
      {resolution && <View style={styles.confirmCard}><Text style={styles.confirmLabel}>FUNCIONARIO IDENTIFICADO</Text><Text style={styles.employeeName}>{resolution.employee.name}</Text><Text style={styles.employeeDetail}>{resolution.employee.identification} · {resolution.employee.department}</Text><View style={[styles.movementBadge, resolution.proposedMovement === 'SALIDA' && styles.exitBadge]}><Text style={styles.movementText}>Movimiento propuesto: {resolution.proposedMovement}</Text></View><Text style={styles.confirmQuestion}>¿Desea registrar este movimiento?</Text><Pressable disabled={loading} onPress={() => void confirm()} style={styles.primaryButton}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Confirmar {resolution.proposedMovement.toLowerCase()}</Text>}</Pressable><Pressable disabled={loading} onPress={() => { setResolution(null); setCode(''); setError(''); }} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar operación</Text></Pressable></View>}
      <View style={styles.notice}><Text style={styles.noticeTitle}>Validaciones activas</Text><Text style={styles.noticeText}>Un TAG desconocido, inactivo, duplicado o asociado con un funcionario inactivo no crea movimientos automáticamente.</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backButton: { paddingVertical: 10, paddingRight: 16 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  brand: { marginLeft: 'auto', color: colors.navy, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.65 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 64 },
  icon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderRadius: 20,
    backgroundColor: colors.success,
  },
  iconText: { color: colors.card, fontSize: 38, fontWeight: '900', fontStyle: 'italic' },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', marginTop: 8 },
  description: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 14 },
  notice: {
    padding: 18,
    marginTop: 28,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    backgroundColor: colors.successLight,
  },
  noticeTitle: { color: '#087344', fontSize: 14, fontWeight: '800' },
  noticeText: { color: '#3F6554', fontSize: 13, lineHeight: 20, marginTop: 5 },
  emergencySnapshot: { padding: 15, marginTop: 18, marginBottom: 16, borderWidth: 1, borderColor: '#BFD7E8', borderRadius: 13, backgroundColor: '#E8F1F8' },
  emergencySnapshotTitle: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: .7 },
  emergencySnapshotText: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 4 },
  nfcContent: { padding: 22, paddingBottom: 45 },
  testBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, marginBottom: 24, borderRadius: 999, backgroundColor: '#FFF3D5' },
  testBadgeText: { color: '#7D4C00', fontSize: 9, fontWeight: '900', letterSpacing: .5 },
  fieldLabel: { marginTop: 24, marginBottom: 7, color: colors.text, fontSize: 12, fontWeight: '800' },
  input: { height: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 11, color: colors.text, backgroundColor: '#fff' },
  primaryButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 13, paddingHorizontal: 16, borderRadius: 11, backgroundColor: colors.primary },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  error: { marginTop: 14, padding: 12, borderRadius: 10, color: '#9A2E2E', backgroundColor: '#FBEAEA' },
  success: { marginTop: 14, padding: 12, borderRadius: 10, color: '#087344', backgroundColor: colors.successLight },
  confirmCard: { padding: 18, marginTop: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: '#fff' },
  confirmLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, employeeName: { marginTop: 8, color: colors.text, fontSize: 22, fontWeight: '800' }, employeeDetail: { marginTop: 5, color: colors.muted, fontSize: 13 },
  movementBadge: { alignSelf: 'flex-start', marginTop: 16, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.successLight }, exitBadge: { backgroundColor: '#E8F1F8' }, movementText: { color: colors.text, fontSize: 11, fontWeight: '900' }, confirmQuestion: { marginTop: 20, color: colors.text, fontSize: 15, fontWeight: '700' },
  cancelButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 11 }, cancelText: { color: colors.primary, fontWeight: '800' },
  employeeResults: { gap: 9, marginTop: 14 }, employeeResult: { padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: '#fff' }, employeeResultName: { color: colors.text, fontSize: 15, fontWeight: '800' }, selectText: { marginTop: 9, color: colors.primary, fontSize: 12, fontWeight: '800' },
  nfcMethodButton: { flexDirection: 'row', alignItems: 'center', padding: 14, marginTop: 20, borderWidth: 1, borderColor: '#BFD7E8', borderRadius: 14, backgroundColor: '#E8F1F8' }, nfcMethodIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderRadius: 12, backgroundColor: colors.primary }, nfcMethodIconText: { color: '#fff', fontSize: 10, fontWeight: '900' }, nfcMethodText: { flex: 1 }, nfcMethodTitle: { color: colors.text, fontSize: 14, fontWeight: '800' }, methodArrow: { color: colors.primary, fontSize: 28 },
  methodDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 }, dividerLine: { flex: 1, height: 1, backgroundColor: colors.border }, dividerText: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: .5 },
  occupantRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border }, removeText: { color: '#9A2E2E', fontSize: 12, fontWeight: '800' },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 20 }, modeButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: '#fff' }, modeActive: { borderColor: colors.primary, backgroundColor: colors.primary }, modeActiveText: { color: '#fff', fontWeight: '800' },
  returnBadgeButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.primary },
  returnBadgeText: { color: '#fff', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  missingBadgeButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 11, paddingHorizontal: 16, borderWidth: 1, borderColor: '#C96767', borderRadius: 12, backgroundColor: '#FFF5F5' },
  missingBadgeText: { color: '#9A2E2E', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  badgeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeOption: { minWidth: 82, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: '#fff' },
  badgeOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
});
