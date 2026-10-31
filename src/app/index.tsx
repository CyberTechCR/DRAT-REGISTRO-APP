import { Redirect, router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SICAFColors as colors } from '@/constants/theme';
import { getApiHealth, getPresenceCount } from '@/services/api';
import { useSession } from '@/auth/SessionContext';

const actions = [
  { id: 'peatonal', icon: 'PER', title: 'Funcionario a pie', detail: 'Identificación mediante TAG NFC o búsqueda manual' },
  { id: 'vehiculo', icon: 'PLA', title: 'Vehículo particular', detail: 'Buscar placa, conductor y acompañantes' },
  { id: 'institucional', icon: 'SOIN', title: 'Vehículo institucional', detail: 'Registrar salida o ingreso mediante boleta SOIN' },
  { id: 'visitante', icon: 'VIS', title: 'Registrar visitante', detail: 'Ingreso a pie y asignación de gafete' },
  { id: 'vehiculo-visitante', icon: 'VVE', title: 'Vehículo visitante', detail: 'Registrar placa y cada ocupante' },
  { id: 'emergencia', icon: 'SOS', title: 'Lista de emergencia', detail: '38 personas dentro · disponible sin conexión' },
  { id: 'catalogos', icon: 'BUS', title: 'Consultar catálogos', detail: 'Funcionario, identificación o placa' },
] as const;

export default function HomeScreen() {
  const { session, signOut } = useSession();
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [presenceCount, setPresenceCount] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getApiHealth(controller.signal)
      .then(() => setApiConnected(true))
      .catch(() => setApiConnected(false));
    return () => controller.abort();
  }, []);

  useFocusEffect(useCallback(() => {
    if (session) getPresenceCount(session.token).then(setPresenceCount).catch(() => setPresenceCount(null));
  }, [session]));

  if (!session) return <Redirect href={'/login' as Href} />;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>S</Text></View>
              <View>
                <Text style={styles.brand}>SICAF · DRAT</Text>
                <Text style={styles.brandDetail}>Control de ingresos y egresos</Text>
              </View>
            </View>
            <Text style={styles.greeting}>Buenos días</Text>
            <Text style={styles.userName}>{session.user.name}</Text>
            <Pressable onPress={signOut} style={styles.logout}><Text style={styles.logoutText}>Cerrar sesión</Text></Pressable>
            <View style={styles.syncBadge}>
              <View style={styles.syncDot} />
              <Text style={styles.syncText}>
                {apiConnected === null ? 'Comprobando API…' : apiConnected ? 'API conectada' : 'API sin conexión'}
              </Text>
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.stationCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>GD</Text></View>
              <View style={styles.stationText}>
                <Text style={styles.eyebrow}>PUESTO ACTUAL</Text>
                <Text style={styles.stationName}>Garita principal · DRAT</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>

            <Text style={styles.eyebrow}>ACCIONES RÁPIDAS</Text>
            <Text style={styles.sectionTitle}>¿Qué desea registrar?</Text>
            <View style={styles.actionList}>
              {actions.map((action) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={action.title}
                  key={action.id}
                  onPress={() => action.id === 'catalogos' ? router.navigate('/catalogos' as Href) :
                    router.navigate({
                      pathname: '/registro/[tipo]',
                      params: { tipo: action.id },
                    })
                  }
                  style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}>
                  <View style={styles.actionIcon}><Text style={styles.actionIconText}>{action.icon}</Text></View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDetail}>{action.id === 'emergencia' && presenceCount !== null ? `${presenceCount} personas dentro · disponible sin conexión` : action.detail}</Text>
                  </View>
                  <Text style={styles.actionArrow}>›</Text>
                </Pressable>
              ))}
              {session.user.role === 'ADMINISTRADOR' && <Pressable
                accessibilityRole="button"
                accessibilityLabel="Administrar TAG NFC"
                onPress={() => router.navigate('/administracion/tags-nfc' as Href)}
                style={({ pressed }) => [styles.adminCard, pressed && styles.actionPressed]}>
                <View style={styles.adminIcon}><Text style={styles.actionIconText}>ADM</Text></View>
                <View style={styles.actionText}><Text style={styles.actionTitle}>Administrar TAG NFC</Text><Text style={styles.actionDetail}>Leer y asignar gafetes a funcionarios sin TAG</Text></View>
                <Text style={styles.actionArrow}>›</Text>
              </Pressable>}
            </View>

            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Modo de demostración</Text>
              <Text style={styles.noticeText}>La lectura NFC está habilitada. OCR y consulta de identidad se conectarán en entregables posteriores.</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.navy, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 48 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 38 },
  brandMark: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 11, backgroundColor: colors.success },
  brandMarkText: { color: colors.card, fontSize: 24, fontWeight: '900', fontStyle: 'italic' },
  brand: { color: colors.card, fontSize: 16, fontWeight: '800', letterSpacing: 0.8 },
  brandDetail: { color: colors.headerMuted, fontSize: 11, marginTop: 2 },
  greeting: { color: colors.headerMuted, fontSize: 14 },
  userName: { color: colors.card, fontSize: 30, fontWeight: '800', marginTop: 4 },
  syncBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 13 },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#43D58B', marginRight: 7 },
  syncText: { color: '#D9E8ED', fontSize: 12, fontWeight: '600' },
  logout: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: '#5F8799', borderRadius: 8 },
  logoutText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  body: { flex: 1, marginTop: -24, paddingHorizontal: 18, paddingBottom: 32, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background },
  stationCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 28, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, shadowColor: '#0B2E40', shadowOpacity: 0.09, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 13, backgroundColor: '#E6F3EC' },
  avatarText: { color: colors.success, fontSize: 15, fontWeight: '800' },
  stationText: { flex: 1 },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  stationName: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 5 },
  chevron: { color: colors.primary, fontSize: 30, fontWeight: '300' },
  sectionTitle: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 5, marginBottom: 16 },
  actionList: { gap: 12 },
  actionCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  actionPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  actionIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 13, backgroundColor: '#E8F1F8' },
  actionIconText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  actionText: { flex: 1 },
  actionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  actionDetail: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  actionArrow: { color: colors.primary, fontSize: 28, marginLeft: 8 },
  adminCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#9ACCB6', backgroundColor: colors.successLight },
  adminIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 13, backgroundColor: '#D7EEE3' },
  notice: { padding: 16, marginTop: 20, borderRadius: 14, borderLeftWidth: 4, borderLeftColor: colors.success, backgroundColor: colors.successLight },
  noticeTitle: { color: '#087344', fontSize: 13, fontWeight: '800' },
  noticeText: { color: '#3F6554', fontSize: 12, lineHeight: 18, marginTop: 4 },
});
