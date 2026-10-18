/**
 * Modelo de Cita — Capa 1: Domain Model
 */
import { AppointmentStatus, PaymentMethods } from '../types/Enums.js';

export class Appointment {
  constructor({
    id,
    clientName,
    clientPhone,
    barberId,
    serviceId,
    date,
    startTime,
    endTime,
    paymentMethod = PaymentMethods.EFECTIVO,
    status = AppointmentStatus.CONFIRMADA,
    calendarEventUid = null,
    createdAt = new Date()
  }) {
    if (!clientName || !barberId || !serviceId || !date || !startTime) {
      throw new Error("Datos incompletos para crear la cita.");
    }
    this.id = id || crypto.randomUUID();
    this.clientName = clientName.trim();
    this.clientPhone = clientPhone ? clientPhone.trim() : '';
    this.barberId = barberId;
    this.serviceId = serviceId;
    this.date = date; // YYYY-MM-DD
    this.startTime = startTime; // HH:MM
    this.endTime = endTime;
    this.paymentMethod = paymentMethod;
    this.status = status;
    this.calendarEventUid = calendarEventUid || `${this.id}@barberialopez.co`;
    this.createdAt = createdAt;
  }

  isCompleted() {
    return this.status === AppointmentStatus.COMPLETADA;
  }
}
