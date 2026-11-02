import { env } from '@/config/env';
import type { Session } from '@/auth/SessionContext';
import * as FileSystem from 'expo-file-system/legacy';

interface ApiHealth {
  status: 'ok';
  service: string;
  timestamp: string;
}

export async function getApiHealth(signal?: AbortSignal): Promise<ApiHealth> {
  const response = await fetch(`${env.apiUrl}/health`, { signal });
  if (!response.ok) {
    throw new Error(`La API respondió con estado ${response.status}`);
  }
  return response.json() as Promise<ApiHealth>;
}

export type PhotoMovementType = 'VEHICULO_PARTICULAR' | 'VEHICULO_INSTITUCIONAL' | 'VEHICULO_VISITANTE' | 'PROVEEDOR_PERMANENTE';
export async function uploadMovementPhoto(token: string, photoUri: string, input: { movementType: PhotoMovementType; movementId: string; plate: string }) {
  const imageBase64 = await FileSystem.readAsStringAsync(photoUri, { encoding: FileSystem.EncodingType.Base64 });
  if (!imageBase64) throw new Error('No fue posible leer la fotografía guardada en el teléfono. El movimiento sí quedó registrado');
  const extension = photoUri.split('?')[0]?.split('.').pop()?.toLowerCase();
  const contentType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  const query = new URLSearchParams(input).toString();
  const response = await fetch(`${env.apiUrl}/api/v1/movements/evidence/photos?${query}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64, contentType }) });
  const body = await response.json() as { data?: { id: string; url: string }; error?: string };
  if (!response.ok || !body.data) throw new Error(body.error ?? 'No fue posible almacenar la fotografía. El movimiento sí quedó registrado');
  return body.data;
}

export type Employee = { id: string; identification: string; name: string; department: string; position: string; active: boolean };
export type NfcTagRecord = { id: string; code: string; employeeId: string | null; active: boolean; condition: 'OPERATIVO' | 'DANADO' | 'PERDIDO' | 'INACTIVO'; purpose: 'GENERAL' | 'VISITANTE'; operationalStatus: 'DISPONIBLE' | 'ASIGNADO' | 'DANADO' | 'PERDIDO' | 'INACTIVO'; visitorAssignment: { name: string } | null; providerAssignment: { id: string; name: string } | null; employee: Employee | null };
export type PermanentProviderRecord = { id: string; identification: string; name: string; company: string; phone: string; active: boolean; vehicles: { id: string; plate: string; active: boolean }[]; tags: { id: string; code: string; active: boolean; condition: string }[] };
export type PermanentProviderInput = { identification: string; name: string; company: string; phone: string; active: boolean; vehiclePlates: string[]; nfcTagIds: string[] };
export type PermanentProviderMovementResolution = { provider: { providerId:string;identification:string;name:string;company:string;phone:string;active:boolean;vehicleId:string|null;plate:string|null;tagId:string|null;tagCode:string|null }; proposedMovement:'INGRESO'|'SALIDA'; lastMovement:{movementType:'INGRESO'|'SALIDA';occurredAt:string}|null };
type InstitutionalVehicle = { id: string; plate: string; brand: string; model: string; year: number; fuelType: string; active: boolean; ownershipType: 'INSTITUCIONAL' };
type PrivateVehicle = { id: string; plate: string; brand: string; model: string; color: string; active: boolean; ownershipType: 'PARTICULAR'; owner: Pick<Employee, 'id' | 'identification' | 'name' | 'active'> };
export type ApiErrorDetails={authorizedRoute?:string;code?:string;entityType?:string;entityId?:string;requestedMovement?:'INGRESO'|'SALIDA'};
export class ApiRequestError extends Error{details?:ApiErrorDetails;status:number;constructor(message:string,details?:ApiErrorDetails,status=0){super(message);this.name='ApiRequestError';this.details=details;this.status=status;}}

async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${env.apiUrl}${path}`, { ...init, headers });
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as T & { error?: string; details?: ApiErrorDetails };
  if (!response.ok) {
    const message = body.error ?? `La API respondió con estado ${response.status}`;
    throw new ApiRequestError(body.details?.authorizedRoute ? `${message}. ${body.details.authorizedRoute}.` : message,body.details,response.status);
  }
  return body;
}

export function login(email: string, password: string) {
  return apiRequest<Session>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export type CatalogResult =
  | { id: string; kind: 'FUNCIONARIO'; title: string; identifier: string; detail: string }
  | { id: string; kind: 'INSTITUCIONAL'; title: string; identifier: string; detail: string }
  | { id: string; kind: 'PARTICULAR'; title: string; identifier: string; detail: string };

export async function searchCatalogs(token: string, search: string): Promise<CatalogResult[]> {
  const query = `?search=${encodeURIComponent(search.trim())}`;
  const [employees, institutional, privateVehicles] = await Promise.all([
    apiRequest<{ data: Employee[] }>(`/api/v1/catalogs/employees${query}`, {}, token),
    apiRequest<{ data: InstitutionalVehicle[] }>(`/api/v1/catalogs/institutional-vehicles${query}`, {}, token),
    apiRequest<{ data: PrivateVehicle[] }>(`/api/v1/catalogs/private-vehicles${query}`, {}, token),
  ]);
  return [
    ...employees.data.filter((item) => item.active).map((item): CatalogResult => ({ id: item.id, kind: 'FUNCIONARIO', title: item.name, identifier: item.identification, detail: `${item.department} · ${item.position}` })),
    ...institutional.data.filter((item) => item.active).map((item): CatalogResult => ({ id: item.id, kind: 'INSTITUCIONAL', title: `${item.brand} ${item.model}`, identifier: item.plate, detail: `${item.year} · ${item.fuelType}` })),
    ...privateVehicles.data.filter((item) => item.active && item.owner?.active).map((item): CatalogResult => ({ id: item.id, kind: 'PARTICULAR', title: `${item.brand} ${item.model}`, identifier: item.plate, detail: `Propietario: ${item.owner.name} · ${item.owner.identification}` })),
  ];
}

export type NfcMovementResolution = {
  tag: { id: string; code: string };
  employee: Employee;
  proposedMovement: 'INGRESO' | 'SALIDA';
  lastMovement: { movementType: 'INGRESO' | 'SALIDA'; occurredAt: string } | null;
};

export async function resolveNfcMovement(token: string, code: string) {
  const response = await apiRequest<{ data: NfcMovementResolution }>('/api/v1/movements/employees/nfc/resolve', { method: 'POST', body: JSON.stringify({ code }) }, token);
  return response.data;
}

export async function confirmNfcMovement(token: string, code: string, movementType: 'INGRESO' | 'SALIDA', source: 'NFC_SIMULADO' | 'NFC_FISICO' = 'NFC_FISICO', offline?: { clientOperationId: string; clientOccurredAt: string }) {
  const response = await apiRequest<{ data: { id: string; movementType: 'INGRESO' | 'SALIDA'; occurredAt: string; duplicate?: boolean } }>('/api/v1/movements/employees/nfc', { method: 'POST', body: JSON.stringify({ code, movementType, source, ...offline }) }, token);
  return response.data;
}

export async function searchActiveEmployees(token: string, search: string) {
  const query = `?search=${encodeURIComponent(search.trim())}`;
  const response = await apiRequest<{ data: Employee[] }>(`/api/v1/catalogs/employees${query}`, {}, token);
  return response.data.filter((employee) => employee.active);
}

export type ManualMovementResolution = Omit<NfcMovementResolution, 'tag'>;

export async function resolveManualMovement(token: string, employeeId: string) {
  const response = await apiRequest<{ data: ManualMovementResolution }>('/api/v1/movements/employees/manual/resolve', { method: 'POST', body: JSON.stringify({ employeeId }) }, token);
  return response.data;
}

export async function confirmManualMovement(token: string, employeeId: string, movementType: 'INGRESO' | 'SALIDA', reason: string, offline?: { clientOperationId: string; clientOccurredAt: string }) {
  const response = await apiRequest<{ data: { id: string; movementType: 'INGRESO' | 'SALIDA'; occurredAt: string; duplicate?: boolean } }>('/api/v1/movements/employees/manual', { method: 'POST', body: JSON.stringify({ employeeId, movementType, reason, ...offline }) }, token);
  return response.data;
}

export async function getPresenceCount(token: string) {
  const response = await apiRequest<{ data: { count: number } }>('/api/v1/movements/employees/presence/count', {}, token);
  return response.data.count;
}

export type EmergencyPresenceRecord = { id: string; kind: 'FUNCIONARIO' | 'VISITANTE' | 'PROVEEDOR'; name: string; identification: string; detail: string; enteredAt: string };

export async function getEmergencyPresence(token: string) {
  const response = await apiRequest<{ data: EmergencyPresenceRecord[] }>('/api/v1/movements/presence/emergency', {}, token);
  return response.data;
}

export type ActiveVisitorVisit = { id: string; identification: string; name: string; reason: string; badgeCode: string | null; entryAt: string };

export async function registerVisitorEntry(token: string, input: { identification: string; name: string; reason: string; badgeCode: string }) {
  const response = await apiRequest<{ data: ActiveVisitorVisit }>('/api/v1/movements/visitors/entry', { method: 'POST', body: JSON.stringify(input) }, token);
  return response.data;
}
export async function registerVisitorEntryWithoutBadge(token:string,input:{identification:string;name:string;reason:string;observation:string;confirmed:boolean}){const response=await apiRequest<{data:ActiveVisitorVisit}>('/api/v1/movements/visitors/entry/badge-contingency',{method:'POST',body:JSON.stringify(input)},token);return response.data;}

export async function getActiveVisitorVisits(token: string, search = '') {
  const response = await apiRequest<{ data: ActiveVisitorVisit[] }>(`/api/v1/movements/visitors/active?search=${encodeURIComponent(search.trim())}`, {}, token);
  return response.data;
}

export async function lookupVisitorIdentity(token: string, identification: string) {
  const response = await apiRequest<{ data: { identification: string; name: string } | null }>(`/api/v1/movements/visitors/identity?identification=${encodeURIComponent(identification.trim())}`, {}, token);
  return response.data;
}

export async function getAvailableVisitorBadges(token: string) {
  const response = await apiRequest<{ data: string[] }>('/api/v1/movements/visitors/badges/available', {}, token);
  return response.data;
}

export async function registerVisitorExit(token: string, visitId: string, badgeCode?: string) {
  const response = await apiRequest<{ data: ActiveVisitorVisit & { badgeReturnPending?: boolean } }>(`/api/v1/movements/visitors/${visitId}/exit`, { method: 'POST', body: JSON.stringify(badgeCode ? { badgeCode } : {}) }, token);
  return response.data;
}

export async function getPendingVisitorBadgeReturns(token: string) {
  const response = await apiRequest<{ data: ActiveVisitorVisit[] }>('/api/v1/movements/visitors/badges/pending', {}, token);
  return response.data;
}

export async function confirmVisitorBadgeReturn(token: string, visitId: string, badgeCode: string) {
  const response = await apiRequest<{ data: ActiveVisitorVisit }>(`/api/v1/movements/visitors/${visitId}/badge-return`, { method: 'POST', body: JSON.stringify({ badgeCode }) }, token);
  return response.data;
}

export async function resolveLegacyVisitorBadgeAlert(token: string, visitId: string) {
  const response = await apiRequest<{ data: ActiveVisitorVisit }>(`/api/v1/movements/visitors/${visitId}/badge-return/legacy-resolution`, { method: 'POST', body: JSON.stringify({}) }, token);
  return response.data;
}

export type VisitorVehicleOccupantInput = { identification: string; name: string; reason: string; badgeCode: string; role: 'CONDUCTOR' | 'OCUPANTE' };

export async function registerVisitorVehicleEntry(token: string, input: { plate: string; occupants: VisitorVehicleOccupantInput[] }) {
  const response = await apiRequest<{ data: { id: string; plate: string; entryAt: string; occupants: VisitorVehicleOccupantInput[] } }>('/api/v1/movements/visitor-vehicles/entry', { method: 'POST', body: JSON.stringify(input) }, token);
  return response.data;
}

export type PrivateVehicleMovementResolution = {
  vehicle: { id: string; plate: string; brand: string; model: string; color: string };
  habitualDriver: Employee;
  proposedMovement: 'INGRESO' | 'SALIDA';
  lastMovement: { id: string; movementType: 'INGRESO' | 'SALIDA'; occurredAt: string } | null;
};

export async function resolvePrivateVehicleMovement(token: string, plate: string) {
  const response = await apiRequest<{ data: PrivateVehicleMovementResolution }>('/api/v1/movements/private-vehicles/resolve', { method: 'POST', body: JSON.stringify({ plate }) }, token);
  return response.data;
}

export async function confirmPrivateVehicleMovement(token: string, input: { plate: string; driverEmployeeId?: string; driverVisitorVisitId?: string; ownerAuthorizationConfirmed?: boolean; authorizationNote?: string; occupantEmployeeIds: string[]; movementType: 'INGRESO' | 'SALIDA'; source?: 'PLACA_MANUAL' | 'OCR'; manualReason?: string }) {
  const response = await apiRequest<{ data: { id: string; movementType: 'INGRESO' | 'SALIDA'; occurredAt: string } }>('/api/v1/movements/private-vehicles', { method: 'POST', body: JSON.stringify({ ...input, source: input.source ?? 'PLACA_MANUAL' }) }, token);
  return response.data;
}

export type InstitutionalTrip = {
  id: string; soinNumber: string; destination: string; departureMileage: number; departureFuel: number;
  departureAt: string; returnMileage: number | null; returnFuel: number | null; returnAt: string | null;
  vehicle: { id: string; plate: string; brand: string; model: string; assetCode: string };
  driver: Employee; occupants: Employee[];
  assets: InstitutionalTripAsset[];
};

export type InstitutionalTripAsset = { id?: string; description: string; quantity: number; identifier?: string | null; observation?: string | null; returnedQuantity?: number | null; returnObservation?: string | null; verifiedAt?: string | null };

export async function resolveInstitutionalDeparture(token: string, plate: string) {
  const response = await apiRequest<{ data: { vehicle: InstitutionalVehicle & { assetCode: string } } }>('/api/v1/movements/institutional-vehicles/departure/resolve', { method: 'POST', body: JSON.stringify({ plate }) }, token);
  return response.data;
}

export async function confirmInstitutionalDeparture(token: string, input: { plate: string; soinNumber: string; mileage: number; fuel: number; destination: string; driverEmployeeId: string; occupantEmployeeIds: string[]; assets: InstitutionalTripAsset[] }) {
  const response = await apiRequest<{ data: InstitutionalTrip }>('/api/v1/movements/institutional-vehicles/departure', { method: 'POST', body: JSON.stringify(input) }, token);
  return response.data;
}

export async function resolveInstitutionalReturn(token: string, soinNumber: string) {
  const response = await apiRequest<{ data: InstitutionalTrip }>('/api/v1/movements/institutional-vehicles/return/resolve', { method: 'POST', body: JSON.stringify({ soinNumber }) }, token);
  return response.data;
}

export async function confirmInstitutionalReturn(token: string, input: { soinNumber: string; mileage: number; fuel: number; assets: { id: string; returnedQuantity: number; observation?: string }[] }) {
  const response = await apiRequest<{ data: InstitutionalTrip }>('/api/v1/movements/institutional-vehicles/return', { method: 'POST', body: JSON.stringify(input) }, token);
  return response.data;
}

export async function getEmployees(token: string) {
  const response = await apiRequest<{ data: Employee[] }>('/api/v1/catalogs/employees', {}, token);
  return response.data;
}

export async function getNfcTags(token: string) {
  const response = await apiRequest<{ data: NfcTagRecord[] }>('/api/v1/catalogs/nfc-tags', {}, token);
  return response.data;
}

export async function createNfcTag(token: string, input: { code: string; employeeId?: string | null; purpose?: 'GENERAL' | 'VISITANTE' }) {
  const response = await apiRequest<{ data: NfcTagRecord }>('/api/v1/catalogs/nfc-tags', { method: 'POST', body: JSON.stringify(input) }, token);
  return response.data;
}

export async function updateNfcTag(token: string, id: string, input: { employeeId?: string | null; active?: boolean; condition?: NfcTagRecord['condition'] }) {
  const response = await apiRequest<{ data: NfcTagRecord }>(`/api/v1/catalogs/nfc-tags/${id}`, { method: 'PATCH', body: JSON.stringify(input) }, token);
  return response.data;
}

export async function getNfcTagHistory(token: string, id: string) {
  const response = await apiRequest<{ data: { id: string; event: string; detail: string; occurredAt: string; changedBy: string }[] }>(`/api/v1/catalogs/nfc-tags/${id}/history`, {}, token);
  return response.data;
}

export async function getPermanentProviders(token: string) {
  const response = await apiRequest<{ data: PermanentProviderRecord[] }>('/api/v1/catalogs/permanent-providers', {}, token);
  return response.data;
}

export async function createPermanentProvider(token: string, input: PermanentProviderInput) {
  const response = await apiRequest<{ data: PermanentProviderRecord }>('/api/v1/catalogs/permanent-providers', { method: 'POST', body: JSON.stringify(input) }, token);
  return response.data;
}

export async function updatePermanentProvider(token: string, id: string, input: PermanentProviderInput) {
  const response = await apiRequest<{ data: PermanentProviderRecord }>(`/api/v1/catalogs/permanent-providers/${id}`, { method: 'PUT', body: JSON.stringify(input) }, token);
  return response.data;
}

export async function resolvePermanentProviderMovement(token:string,input:{code?:string;plate?:string}){const response=await apiRequest<{data:PermanentProviderMovementResolution}>('/api/v1/movements/permanent-providers/resolve',{method:'POST',body:JSON.stringify(input)},token);return response.data;}
export async function confirmPermanentProviderMovement(token:string,input:{code?:string;plate?:string;movementType:'INGRESO'|'SALIDA'}){const response=await apiRequest<{data:{id:string}}>('/api/v1/movements/permanent-providers',{method:'POST',body:JSON.stringify(input)},token);return response.data;}
export async function createVehicleExceptionAuthorization(token:string,input:{entityId:string;movementType:'INGRESO'|'SALIDA';reason:string;authorizedByReference:string;observations:string}){const response=await apiRequest<{data:unknown}>('/api/v1/movements/contingencies',{method:'POST',body:JSON.stringify({entityType:'VEHICULO_PARTICULAR',...input})},token);return response.data;}

export async function deleteNfcTag(token: string, id: string) {
  await apiRequest<void>(`/api/v1/catalogs/nfc-tags/${id}`, { method: 'DELETE' }, token);
}
