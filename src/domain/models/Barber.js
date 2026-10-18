/**
 * Modelo de Barbero — Capa 1: Domain Model
 */
export class Barber {
  constructor({ id, userId = null, name, specialty = 'Barbero Profesional', phone = '', avatar = '', active = true }) {
    if (!name) throw new Error("El barbero requiere un nombre.");
    this.id = id || crypto.randomUUID();
    this.userId = userId;
    this.name = name.trim();
    this.specialty = specialty;
    this.phone = phone;
    this.avatar = avatar;
    this.active = active;
  }
}
