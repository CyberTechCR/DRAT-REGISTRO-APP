import { Redirect, router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/SessionContext';
import { SICAFColors as colors } from '@/constants/theme';
import { createPermanentProvider, getNfcTags, getPermanentProviders, updatePermanentProvider, type NfcTagRecord, type PermanentProviderInput, type PermanentProviderRecord } from '@/services/api';

const emptyForm: PermanentProviderInput = { identification: '', name: '', company: '', phone: '', active: true, vehiclePlates: [], nfcTagIds: [] };

export default function PermanentProvidersAdministrationScreen() {
  const { session } = useSession();
  const [providers, setProviders] = useState<PermanentProviderRecord[]>([]); const [tags, setTags] = useState<NfcTagRecord[]>([]);
  const [form, setForm] = useState(emptyForm); const [plates, setPlates] = useState(''); const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const token = session?.token ?? '';
  const load = useCallback(async () => { const [items, tagItems] = await Promise.all([getPermanentProviders(token), getNfcTags(token)]); setProviders(items); setTags(tagItems.filter((tag) => tag.purpose === 'GENERAL' && !tag.employeeId && tag.condition === 'OPERATIVO')); }, [token]);
  useEffect(() => {
    if (!session || session.user.role !== 'ADMINISTRADOR') return;
    Promise.all([getPermanentProviders(session.token), getNfcTags(session.token)])
      .then(([items, tagItems]) => { setProviders(items); setTags(tagItems.filter((tag) => tag.purpose === 'GENERAL' && !tag.employeeId && tag.condition === 'OPERATIVO')); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar los proveedores'))
      .finally(() => setLoading(false));
  }, [session]);
  if (!session) return <Redirect href={'/login' as Href}/>; if (session.user.role !== 'ADMINISTRADOR') return <Redirect href={'/' as Href}/>;

  function toggleTag(id: string) { setForm((current) => ({ ...current, nfcTagIds: current.nfcTagIds.includes(id) ? current.nfcTagIds.filter((item) => item !== id) : [...current.nfcTagIds, id] })); }
  function edit(provider: PermanentProviderRecord) { setEditingId(provider.id); setForm({ identification: provider.identification, name: provider.name, company: provider.company, phone: provider.phone, active: provider.active, vehiclePlates: provider.vehicles.map((item) => item.plate), nfcTagIds: provider.tags.map((item) => item.id) }); setPlates(provider.vehicles.map((item) => item.plate).join(', ')); setError(''); setMessage(''); }
  async function save() {
    setSaving(true); setError(''); setMessage('');
    const input = { ...form, vehiclePlates: plates.split(',').map((plate) => plate.trim()).filter(Boolean) };
    try { if (editingId) await updatePermanentProvider(token, editingId, input); else await createPermanentProvider(token, input); setMessage(editingId ? 'Proveedor actualizado.' : 'Proveedor creado.'); setEditingId(null); setForm(emptyForm); setPlates(''); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar el proveedor'); } finally { setSaving(false); }
  }
  const selectableTags = tags.filter((tag) => tag.operationalStatus === 'DISPONIBLE' || form.nfcTagIds.includes(tag.id));

  return <SafeAreaView style={styles.screen}><View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Volver</Text></Pressable><Text style={styles.brand}>ADMINISTRACIÓN</Text></View><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>ACCESO FRECUENTE</Text><Text style={styles.title}>Proveedores permanentes</Text><Text style={styles.description}>Administre proveedores frecuentes, sus vehículos y gafetes. Los ocasionales se registran como visitantes.</Text>
    <View style={styles.card}><Text style={styles.section}>{editingId ? 'Editar proveedor' : 'Crear proveedor'}</Text>
      <Text style={styles.label}>Identificación</Text><TextInput style={styles.input} value={form.identification} onChangeText={(value) => setForm({ ...form, identification: value })}/>
      <Text style={styles.label}>Nombre</Text><TextInput style={styles.input} value={form.name} onChangeText={(value) => setForm({ ...form, name: value })}/>
      <Text style={styles.label}>Empresa</Text><TextInput style={styles.input} value={form.company} onChangeText={(value) => setForm({ ...form, company: value })}/>
      <Text style={styles.label}>Teléfono o contacto</Text><TextInput style={styles.input} value={form.phone} onChangeText={(value) => setForm({ ...form, phone: value })}/>
      <Text style={styles.label}>Placas separadas por coma</Text><TextInput style={styles.input} autoCapitalize="characters" value={plates} onChangeText={setPlates} placeholder="ABC123, DEF456"/>
      <Text style={styles.label}>Gafetes NFC operativos y disponibles</Text><View style={styles.tagList}>{selectableTags.length === 0 ? <Text style={styles.muted}>No hay TAG disponibles.</Text> : selectableTags.map((tag) => <Pressable key={tag.id} onPress={() => toggleTag(tag.id)} style={[styles.tag, form.nfcTagIds.includes(tag.id) && styles.tagSelected]}><Text style={[styles.tagText, form.nfcTagIds.includes(tag.id) && styles.tagTextSelected]}>{tag.code}</Text></Pressable>)}</View>
      <View style={styles.switchRow}><Text style={styles.labelInline}>Proveedor activo</Text><Switch value={form.active} onValueChange={(active) => setForm({ ...form, active })}/></View>
      <Pressable disabled={saving || !form.identification.trim() || !form.name.trim() || !form.company.trim() || !form.phone.trim()} onPress={() => void save()} style={[styles.primary, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#fff"/> : <Text style={styles.primaryText}>{editingId ? 'Guardar cambios' : 'Crear proveedor'}</Text>}</Pressable>
      {editingId ? <Pressable onPress={() => { setEditingId(null); setForm(emptyForm); setPlates(''); }} style={styles.secondary}><Text style={styles.secondaryText}>Cancelar edición</Text></Pressable> : null}
    </View>{error ? <Text style={styles.error}>{error}</Text> : null}{message ? <Text style={styles.success}>{message}</Text> : null}
    <Text style={styles.sectionHeading}>Proveedores registrados</Text>{loading ? <ActivityIndicator color={colors.primary}/> : providers.length === 0 ? <Text style={styles.empty}>No hay proveedores registrados.</Text> : providers.map((provider) => <View key={provider.id} style={styles.card}><Text style={styles.providerName}>{provider.name}</Text><Text style={styles.muted}>{provider.identification} · {provider.company}</Text><Text style={styles.muted}>Contacto: {provider.phone}</Text><Text style={styles.muted}>Placas: {provider.vehicles.map((item) => item.plate).join(', ') || 'Sin placas'}</Text><Text style={styles.muted}>TAG: {provider.tags.map((item) => item.code).join(', ') || 'Sin TAG'} · {provider.active ? 'Activo' : 'Inactivo'}</Text><Pressable onPress={() => edit(provider)} style={styles.secondary}><Text style={styles.secondaryText}>Editar proveedor</Text></Pressable></View>)}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ screen:{flex:1,backgroundColor:colors.background},header:{minHeight:64,flexDirection:'row',alignItems:'center',paddingHorizontal:18,borderBottomWidth:1,borderBottomColor:colors.border,backgroundColor:'#fff'},back:{color:colors.primary,fontSize:16,fontWeight:'700'},brand:{marginLeft:'auto',color:colors.navy,fontSize:13,fontWeight:'900'},content:{padding:22,paddingBottom:60},eyebrow:{color:colors.muted,fontSize:10,fontWeight:'900',letterSpacing:1},title:{color:colors.text,fontSize:28,fontWeight:'800',marginTop:7},description:{color:colors.muted,fontSize:14,lineHeight:21,marginTop:10,marginBottom:10},card:{padding:16,marginTop:14,borderWidth:1,borderColor:colors.border,borderRadius:14,backgroundColor:'#fff'},section:{color:colors.text,fontSize:19,fontWeight:'800',marginBottom:5},label:{color:colors.text,fontSize:12,fontWeight:'800',marginTop:13,marginBottom:6},input:{minHeight:48,paddingHorizontal:13,borderWidth:1,borderColor:colors.border,borderRadius:10,color:colors.text,backgroundColor:'#fff'},tagList:{flexDirection:'row',flexWrap:'wrap',gap:8},tag:{paddingHorizontal:12,paddingVertical:10,borderWidth:1,borderColor:colors.border,borderRadius:9},tagSelected:{borderColor:colors.primary,backgroundColor:colors.primary},tagText:{color:colors.primary,fontWeight:'800'},tagTextSelected:{color:'#fff'},switchRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:15},labelInline:{color:colors.text,fontWeight:'800'},primary:{minHeight:50,alignItems:'center',justifyContent:'center',marginTop:16,borderRadius:11,backgroundColor:colors.primary},primaryText:{color:'#fff',fontWeight:'800'},secondary:{minHeight:46,alignItems:'center',justifyContent:'center',marginTop:10,paddingHorizontal:12,borderWidth:1,borderColor:colors.border,borderRadius:10},secondaryText:{color:colors.primary,fontWeight:'800'},disabled:{opacity:.55},sectionHeading:{marginTop:28,color:colors.text,fontSize:20,fontWeight:'800'},providerName:{color:colors.text,fontSize:17,fontWeight:'900'},muted:{color:colors.muted,lineHeight:21,marginTop:3},error:{marginTop:14,padding:12,borderRadius:10,color:'#9A2E2E',backgroundColor:'#FBEAEA'},success:{marginTop:14,padding:12,borderRadius:10,color:'#087344',backgroundColor:colors.successLight},empty:{padding:16,color:colors.muted,backgroundColor:'#fff',borderRadius:12} });
