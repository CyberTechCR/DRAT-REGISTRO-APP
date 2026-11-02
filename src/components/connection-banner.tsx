import { StyleSheet, Text, View } from 'react-native';
import { useOffline } from '@/offline/OfflineProvider';

export function ConnectionBanner() {
  const { isOnline, pending, syncing, conflicts, lastSuccessfulSync } = useOffline();
  const lastSync = lastSuccessfulSync ? new Date(lastSuccessfulSync).toLocaleString('es-CR') : 'aún no realizada';
  return <View style={[styles.banner, isOnline ? styles.online : styles.offline]}><View style={[styles.dot, { backgroundColor: isOnline ? '#087344' : '#9A3412' }]}/><View style={styles.copy}><Text style={styles.text}>{isOnline ? (syncing ? 'Sincronizando registros locales…' : `En línea${pending ? ` · ${pending} pendiente${pending === 1 ? '' : 's'}` : ''}${conflicts.length ? ` · ${conflicts.length} conflicto(s)` : ''}`) : `Sin conexión · modo local${pending ? ` · ${pending} pendiente${pending === 1 ? '' : 's'}` : ''}`}</Text><Text style={styles.detail}>Última sincronización exitosa: {lastSync}</Text></View></View>;
}
const styles=StyleSheet.create({banner:{minHeight:50,paddingHorizontal:16,paddingVertical:7,flexDirection:'row',alignItems:'center',justifyContent:'center'},online:{backgroundColor:'#E7F6EE'},offline:{backgroundColor:'#FFF1E8'},dot:{width:8,height:8,borderRadius:4,marginRight:8},copy:{flexShrink:1},text:{fontSize:12,fontWeight:'800',color:'#17384A'},detail:{fontSize:10,color:'#526B78',marginTop:2}});
