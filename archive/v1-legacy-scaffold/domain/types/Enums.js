/**
 * Enums del Dominio — Barbería Lopez
 * Capa 1: Domain Model (Cero dependencias)
 */

export const Roles = Object.freeze({
  ADMIN: 'ADMIN',
  JEFE: 'JEFE',
  PRACTICANTE: 'PRACTICANTE'
});

export const PaymentMethods = Object.freeze({
  EFECTIVO: 'EFECTIVO',
  TRANSFERENCIA: 'TRANSFERENCIA'
});

export const AppointmentStatus = Object.freeze({
  PENDIENTE: 'PENDIENTE',
  CONFIRMADA: 'CONFIRMADA',
  COMPLETADA: 'COMPLETADA',
  CANCELADA: 'CANCELADA'
});
