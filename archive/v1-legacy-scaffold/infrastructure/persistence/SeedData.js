/**
 * Datos Semilla Oficiales — Barbería Lopez (Neiva, Huila)
 * Capa 4: Infrastructure Persistence
 */
import { Roles, PaymentMethods, AppointmentStatus } from '../../domain/types/Enums.js';

export const SEED_USERS = [
  {
    id: 'u-admin-01',
    username: 'admin',
    passwordHash: 'admin2026',
    role: Roles.ADMIN,
    barberId: null,
    active: true
  },
  {
    id: 'u-david-01',
    username: 'david.barber',
    passwordHash: 'david2026',
    role: Roles.JEFE,
    barberId: 'b-david-01',
    active: true
  },
  {
    id: 'u-matta-01',
    username: 'matta.barber',
    passwordHash: 'matta2026',
    role: Roles.BARBERO,
    barberId: 'b-matta-01',
    active: true
  }
];

export const SEED_BARBERS = [
  {
    id: 'b-david-01',
    userId: 'u-david-01',
    name: 'David',
    specialty: 'Barbero Jefe · Maestro Barbero',
    phone: '+57 321 989 7910',
    avatar: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=400&q=80',
    active: true,
    onShift: true
  },
  {
    id: 'b-matta-01',
    userId: 'u-matta-01',
    name: 'Maicol Matta',
    specialty: 'Barbero Profesional · Degradados & Barba',
    phone: '+57 300 000 0000',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    active: true,
    onShift: true
  }
];

export const SEED_SERVICES = [
  {
    id: 's-01',
    name: 'Corte Básico',
    category: 'Tradicional',
    durationMinutes: 30,
    priceCop: 20000,
    description: 'Corte tradicional al gusto con tijera y máquina, perfilado de patillas y cuello con navaja.',
    active: true
  },
  {
    id: 's-02',
    name: 'Combo 1',
    category: 'Combos',
    durationMinutes: 45,
    priceCop: 25000,
    description: 'Corte de cabello + Perfilado de barba sencilla con vapor caliente y loción aftershave.',
    active: true
  },
  {
    id: 's-03',
    name: 'Combo 2',
    category: 'Combos',
    durationMinutes: 50,
    priceCop: 35000,
    description: 'Corte de cabello + Barba detallada con toalla caliente + Perfilado y sombreado de cejas.',
    active: true
  },
  {
    id: 's-04',
    name: 'Combo 3',
    category: 'Combos',
    durationMinutes: 60,
    priceCop: 40000,
    description: 'Corte + Barba completa + Mascarilla facial de puntos negros y exfoliación energizante.',
    active: true
  },
  {
    id: 's-05',
    name: 'Combi Completa VIP',
    category: 'Experiencia VIP',
    durationMinutes: 75,
    priceCop: 65000,
    description: 'Corte VIP + Barba spa ritual + Mascarilla hidratante + Pigmentación de contorno.',
    active: true
  },
  {
    id: 's-06',
    name: 'Pigmentación Aerógrafo',
    category: 'Pigmentación',
    durationMinutes: 30,
    priceCop: 18000,
    description: 'Definición de contornos capilares y barba con aerógrafo de alta precisión y acabado natural.',
    active: true
  },
  {
    id: 's-07',
    name: 'Pigmentación Manual',
    category: 'Pigmentación',
    durationMinutes: 35,
    priceCop: 22000,
    description: 'Pigmentación artesanal aplicada a pincel para máxima fijación y densidad de líneas.',
    active: true
  }
];

export const SEED_APPOINTMENTS = [
  {
    id: 'a-01',
    clientName: 'Mateo Garzón',
    clientPhone: '+57 311 234 5678',
    barberId: 'b-jefe-01',
    serviceId: 's-03',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '10:50',
    paymentMethod: PaymentMethods.TRANSFERENCIA,
    status: AppointmentStatus.COMPLETADA,
    calendarEventUid: 'a-01@barberialopez.co',
    createdAt: new Date().toISOString()
  },
  {
    id: 'a-02',
    clientName: 'Julián Castro',
    clientPhone: '+57 315 987 6543',
    barberId: 'b-junior-01',
    serviceId: 's-01',
    date: new Date().toISOString().split('T')[0],
    startTime: '11:00',
    endTime: '11:30',
    paymentMethod: PaymentMethods.EFECTIVO,
    status: AppointmentStatus.COMPLETADA,
    calendarEventUid: 'a-02@barberialopez.co',
    createdAt: new Date().toISOString()
  },
  {
    id: 'a-03',
    clientName: 'Felipe Ordóñez',
    clientPhone: '+57 317 555 4433',
    barberId: 'b-junior-01',
    serviceId: 's-02',
    date: new Date().toISOString().split('T')[0],
    startTime: '15:00',
    endTime: '15:45',
    paymentMethod: PaymentMethods.EFECTIVO,
    status: AppointmentStatus.CONFIRMADA,
    calendarEventUid: 'a-03@barberialopez.co',
    createdAt: new Date().toISOString()
  }
];

export const SEED_HISTORY = [
  {
    id: 'h-01',
    appointmentId: 'a-01',
    barberId: 'b-jefe-01',
    clientName: 'Mateo Garzón',
    date: new Date().toISOString().split('T')[0],
    time: '10:50',
    priceCop: 35000,
    createdAt: new Date().toISOString()
  },
  {
    id: 'h-02',
    appointmentId: 'a-02',
    barberId: 'b-junior-01',
    clientName: 'Julián Castro',
    date: new Date().toISOString().split('T')[0],
    time: '11:30',
    priceCop: 20000,
    createdAt: new Date().toISOString()
  }
];
