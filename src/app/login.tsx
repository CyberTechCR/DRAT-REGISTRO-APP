import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/SessionContext';
import { SICAFColors as colors } from '@/constants/theme';

export default function LoginScreen() {
  const { session, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) return <Redirect href="/" />;

  async function submit() {
    setLoading(true); setError('');
    try { await signIn(email, password); router.replace('/'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible iniciar sesión'); }
    finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
        <View style={styles.logo}><Text style={styles.logoText}>S</Text></View>
        <Text style={styles.eyebrow}>SICAF · DRAT</Text><Text style={styles.title}>Iniciar sesión</Text>
        <Text style={styles.description}>Acceso operativo para el personal autorizado de seguridad.</Text>
        <Text style={styles.label}>Correo electrónico</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} />
        <Text style={styles.label}>Contraseña</Text><TextInput autoCapitalize="none" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} onSubmitEditing={() => void submit()} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => void submit()} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Ingresar</Text>}</Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  card: { padding: 24, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.card },
  logo: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderRadius: 14, backgroundColor: colors.success },
  logoText: { color: '#fff', fontSize: 30, fontWeight: '900', fontStyle: 'italic' },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  title: { marginTop: 5, color: colors.text, fontSize: 28, fontWeight: '800' },
  description: { marginTop: 8, marginBottom: 22, color: colors.muted, fontSize: 13, lineHeight: 19 },
  label: { marginBottom: 7, color: colors.text, fontSize: 12, fontWeight: '700' },
  input: { height: 48, marginBottom: 15, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 11, color: colors.text, backgroundColor: '#fff' },
  error: { marginBottom: 14, padding: 11, borderRadius: 9, color: '#9A2E2E', backgroundColor: '#FBEAEA' },
  button: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.primary },
  buttonText: { color: '#fff', fontWeight: '800' }, pressed: { opacity: .8 }, disabled: { opacity: .6 },
});
