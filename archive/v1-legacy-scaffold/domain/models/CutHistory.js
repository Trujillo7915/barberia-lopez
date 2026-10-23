/**
 * Modelo de Historial Inmutable de Corte — Capa 1: Domain Model
 */
export class CutHistory {
  constructor({ id, appointmentId = null, barberId, clientName, date, time, priceCop, createdAt = new Date() }) {
    if (!clientName || !date || !time || priceCop == null) {
      throw new Error("Historial de corte requiere cliente, fecha, hora y valor.");
    }
    this.id = id || crypto.randomUUID();
    this.appointmentId = appointmentId;
    this.barberId = barberId;
    this.clientName = clientName.trim();
    this.date = date; // YYYY-MM-DD
    this.time = time; // HH:MM
    this.priceCop = Number(priceCop);
    this.createdAt = createdAt;
  }
}
