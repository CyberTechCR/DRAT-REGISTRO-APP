import { StyleSheet, Text, View } from 'react-native';
import { useOffline } from '@/offline/OfflineProvider';

export function ConnectionBanner() {
  const { isOnline, pending, syncing } = useOffline();
  return <View style={[styles.banner, isOnline ? styles.online : styles.offline]}><View style={[styles.dot, { backgroundColor: isOnline ? '#087344' : '#9A3412' }]}/><Text style={styles.text}>{isOnline ? (syncing ? 'Sincronizando registros locales…' : `En línea${pending ? ` · ${pending} pendiente${pending === 1 ? '' : 's'}` : ''}`) : `Sin conexión · modo local${pending ? ` · ${pending} pendiente${pending === 1 ? '' : 's'}` : ''}`}</Text></View>;
}
const styles=StyleSheet.create({banner:{minHeight:38,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'center'},online:{backgroundColor:'#E7F6EE'},offline:{backgroundColor:'#FFF1E8'},dot:{width:8,height:8,borderRadius:4,marginRight:8},text:{fontSize:12,fontWeight:'800',color:'#17384A'}});
